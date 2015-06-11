// Copyright (C) 2014-2015 Lester Carballo Pérez <lestcape@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

const Lang = imports.lang;
const Signals = imports.signals;

const Main = imports.ui.main;

const AppletPath = imports.ui.appletManager.applets['globalAppMenu@lestcape'];
const Utility = AppletPath.utility;
const DBusMenu = AppletPath.dbusMenu;

const WATCHER_INTERFACE = 'com.canonical.AppMenu.Registrar';
const WATCHER_OBJECT = '/com/canonical/AppMenu/Registrar';

const AppmenuMode = {
    MODE_STANDARD: 0,
    MODE_UNITY: 1,
    MODE_UNITY_ALL_MENUS: 2
};

const LOG_NAME = "Indicator AppMenu Whatcher:";
/*
const STUBS_BLACKLIST = [
    // Firefox
    "/firefox.desktop",
    // Thunderbird
    "/thunderbird.desktop",
    // Open Office
    "/openoffice.org-base.desktop",
    "/openoffice.org-impress.desktop",
    "/openoffice.org-calc.desktop",
    "/openoffice.org-math.desktop",
    "/openoffice.org-draw.desktop",
    "/openoffice.org-writer.desktop",
    // Blender
    "/blender-fullscreen.desktop",
    "/blender-windowed.desktop",
    // Eclipse
    "/eclipse.desktop"
];
*/

/*
 * The IndicatorAppMenuWatcher class implements the IndicatorAppMenu dbus object
 */
function IndicatorAppMenuWatcher() {
    this._init.apply(this, arguments);
}

IndicatorAppMenuWatcher.prototype = {

    _init: function(mode, iconSize) {
        this._mode = mode;
        this._iconSize = iconSize;

        this._registeredWindows = { };
        this._everAcquiredName = false;
        this._ownName = null;

        this._xidLast = 0;
        this._windowsChangedId = 0;
        this._notifyWorkspacesId = 0;
        this._focusWindowId = 0;

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(Utility.DBusRegistrar, this);
        this._dbusImpl.export(Gio.DBus.session, WATCHER_OBJECT);

        this._tracker = Cinnamon.WindowTracker.get_default();
        this._system = Utility.system;
        this._isReady = this._initEnviroment();
    },

    // DBus Functions
    RegisterWindowAsync: function(params, invocation) {
        let [xid, menubarObjectPath] = params;
        let wind = null;
        this._registerWindowXId(xid, wind, menubarObjectPath, invocation.get_sender());
        this._emitWindowRegistered(xid, invocation.get_sender(), menubarObjectPath);
    },

    UnregisterWindowAsync: function(params, invocation) {
        let [xid] = params;
        this._destroyMenu(xid);
    },

    GetMenuForWindowAsync: function(params, invocation) {
        let [xid] = params;
        let retval;
        if(xid in this._registeredWindows)
            retval = GLib.Variant.new('(so)', [this._registeredWindows[xid].sender, this._registeredWindows[xid].menubarObjectPath]);
        else
            retval = [];
        invocation.return_value(retval);
    },

    GetMenusAsync: function(params, invocation) {
        let result = [];
        for(let xid in this._registeredWindows) {
            result.push([xid, this._registeredWindows[xid].sender, this._registeredWindows[xid].menubarObjectPath]);
        }
        let retval = GLib.Variant.new('(a(uso))', result);
        invocation.return_value(retval);
    },

    // DBus Signals
    _emitWindowRegistered: function(xid, service, menubarObjectPath) {
        this._dbusImpl.emit_signal('WindowRegistered', GLib.Variant.new('(uso)', [xid, service, menubarObjectPath]));
        global.log("%s RegisterWindow %d %s %s".format(LOG_NAME, xid, service, menubarObjectPath));
    },

    _emitWindowUnregistered: function(xid) {
        this._dbusImpl.emit_signal('WindowUnregistered', GLib.Variant.new('(u)', [xid]));
        global.log("%s UnregisterWindow %d".format(LOG_NAME, xid));
    },

    // Public functions
    watch: function() {
        if ((this._isReady)&&(!this._ownName)) {
            this._ownName = Gio.DBus.session.own_name(WATCHER_INTERFACE,
                                  Gio.BusNameOwnerFlags.NONE,
                                  Lang.bind(this, this._acquiredName),
                                  Lang.bind(this, this._lostName));

            this._registerAllWindows();
            this._onWindowChanged();

            if(this._windowsChangedId == 0) {
                this._windowsChangedId = this._tracker.connect('tracked-windows-changed',
                                         Lang.bind(this, this._updateWindowsList));
            }
            if(this._notifyWorkspacesId == 0) {
                this._notifyWorkspacesId = global.screen.connect('notify::n-workspaces',
                                           Lang.bind(this, this._registerAllWindows));
            }
            if(this._focusWindowId == 0) {
                this._focusWindowId = global.screen.get_display().connect('notify::focus-window',
                                      Lang.bind(this, this._onWindowChanged));
            }
        }
    },

    canWatch: function() {
        return this._isReady;
    },

    isWatching: function() {
        return ((this._isReady) && (this._ownName));
    },

    getMenuForWindow: function(wind) {
        let xid = this._guessWindowXId(wind);
        if((xid) && (xid in this._registeredWindows)) {
            let appmenu = this._registeredWindows[xid].appMenu;
            if (appmenu)
                return appmenu.getRoot();
        }
        return null;
    },

    updateMenuForWindow: function(wind) {
        let xid = this._guessWindowXId(wind);
        if((xid) && (xid in this._registeredWindows)) {
            let appmenu = this._registeredWindows[xid].appMenu;
            if (appmenu)
                appmenu.sendAboutToShow(appmenu.getRootId());
        }
    },

    getAppForWindow: function(wind) {
        let xid = this._guessWindowXId(wind);
        if((xid) && (xid in this._registeredWindows))
            return this._registeredWindows[xid].application;
        return null;
    },

    getIconForWindow: function(wind) {
        let xid = this._guessWindowXId(wind);
        if((xid) && (xid in this._registeredWindows))
            return this._registeredWindows[xid].icon;
        return null;
    },

    setIconSize: function(iconSize) {
        if(this._iconSize != iconSize) {
            this._iconSize = iconSize;
            for (let xid in this._registeredWindows) {
                this._updateIcon(xid);
            }
            if(this._xidLast) {
                this.emit('appmenu-changed', this._registeredWindows[this._xidLast].window);
            }
        }
    },

    // Private functions
    _initEnviroment: function() {
        let isReady = this._system.activeUnityGtkModule(true);
        if (isReady) {
            this._system.shellShowAppmenu(true);
            this._system.shellShowMenubar(true);
            this._system.activeUnityMenuProxy(true);
            return true;
        }
        return false;
    },

    _acquiredName: function() {
        this._everAcquiredName = true;
        global.log("%s Acquired name %s".format(LOG_NAME, WATCHER_INTERFACE));
    },

    _lostName: function() {
        if (this._everAcquiredName)
            global.log("%s Lost name %s".format(LOG_NAME, WATCHER_INTERFACE));
        else
            global.logWarning("%s Failed to acquire %s".format(LOG_NAME, WATCHER_INTERFACE));
    },

    // Async because we may need to check the presence of a menubar object as well as the creation is async.
    _getMenuClient: function(xid, callback) {
        if(xid in this._registeredWindows) {
            var sender = this._registeredWindows[xid].sender;
            var menubarPath = this._registeredWindows[xid].menubarObjectPath;
            var windowPath = this._registeredWindows[xid].windowObjectPath;
            var appPath = this._registeredWindows[xid].appObjectPath;
            var is_gtk = this._registeredWindows[xid].isGtk;
            if((sender)&&(menubarPath)) {
                if(!is_gtk) {
                    this._validateMenu(sender, menubarPath, Lang.bind(this, function(r, name, menubarPath) {
                        if (r) {
                            if(!this._registeredWindows[xid].appMenu) {
                                global.log("%s Creating menu on %s, %s".format(LOG_NAME, sender, menubarPath));
                                callback(xid, new DBusMenu.DBusClient(name, menubarPath));
                            } else {
                                callback(xid, null);
                            }
                        } else {
                            callback(xid, null);
                        }
                    }));
                } else {
                    if(!this._registeredWindows[xid].appMenu) {
                        global.log("%s Creating menu on %s, %s".format(LOG_NAME, sender, menubarPath));
                        callback(xid, new DBusMenu.DBusClientGtk(sender, menubarPath, windowPath, appPath));
                    } else {
                        callback(xid, null);
                    }
                }
            } else {
                callback(xid, null);
            }
        } else {
            callback(xid, null);
        }
    },

    _onMenuClientReady: function(xid, client) {
        if (client != null) {
            this._registeredWindows[xid].appMenu = client;
            if(!this._registeredWindows[xid].window) {
                this._registerAllWindows();
            }
            if (this._guessWindowXId(global.display.focus_window) == xid)
                this._onWindowChanged();
            let root = client.getRoot();
            root.connectAndRemoveOnDestroy({
                'childs-empty'   : Lang.bind(this, this._onMenuEmpty, xid),
                'destroy'        : Lang.bind(this, this._onMenuDestroy, xid)
            });
        }
    },

    _onMenuEmpty: function(root, xid) {
        // We don't have alternatives now, so destroy the appmenu.
        this._onMenuDestroy(root, xid);
    },

    _onMenuDestroy: function(root, xid) {
        this._destroyMenu(xid);
    },

    _destroyMenu: function(xid) {
        if((xid) && (xid in this._registeredWindows)) {
            let appMenu = this._registeredWindows[xid].appMenu;
            this._registeredWindows[xid].appMenu = null;
            if (appMenu) {
                appMenu.destroy();
                this._emitWindowUnregistered(xid);
            }
            if(this._xidLast == xid)
                this.emit('appmenu-changed', this._registeredWindows[xid].window);
        }
    },

    _validateMenu: function(bus, path, callback) {
        Gio.DBus.session.call(
            bus, path, "org.freedesktop.DBus.Properties", "Get",
            GLib.Variant.new("(ss)", ["com.canonical.dbusmenu", "Version"]),
            GLib.VariantType.new("(v)"), Gio.DBusCallFlags.NONE, -1, null, function(conn, result) {
                try {
                    var val = conn.call_finish(result);
                } catch (e) {
                    global.logWarning(LOG_NAME + "Invalid menu. " + e);
                    return callback(false);
                }
                var version = val.deep_unpack()[0].deep_unpack();
                // FIXME: what do we implement?
                if (version >= 2) {
                    return callback(true, bus, path);
                } else {
                    global.logWarning("%s Incompatible dbusmenu version %s".format(LOG_NAME, version));
                    return callback(false);
                }
            }, null
        );
    },

    _registerAllWindows: function () {
        for(let index = 0; index < global.screen.n_workspaces; index++) {
            let metaWorkspace = global.screen.get_workspace_by_index(index);
            let winList = metaWorkspace.list_windows();
            // For each window, let's make sure we add it!
            for(let pos in winList) {
                let wind = winList[pos];
                let xid = this._guessWindowXId(wind);
                if(xid)
                    this._registerWindowXId(xid, wind);
            }
        }
    },

    _updateWindowsList: function () {
        let current = new Array();
        for(let index = 0; index < global.screen.n_workspaces; index++) {
            let metaWorkspace = global.screen.get_workspace_by_index(index);
            let winList = metaWorkspace.list_windows();
            // For each window, let's make sure we add it!
            for(let pos in winList) {
                let wind = winList[pos];
                let xid = this._guessWindowXId(wind);
                if(xid)
                    current.push(xid.toString());
            }
        }
        for (let xid in this._registeredWindows) {
            if(current.indexOf(xid) == -1) {
                this._destroyMenu(xid);
                delete this._registeredWindows[xid];
            }
        }
    },

    _updateIcon: function(xid) {
        if (xid in this._registeredWindows) {
            if(this._registeredWindows[xid].icon) {
                this._registeredWindows[xid].icon.destroy();
                this._registeredWindows[xid].icon = null;
            }
            let app = this._registeredWindows[xid].application;
            if(app) {
              let icon = app.create_icon_texture(this._iconSize);
              this._registeredWindows[xid].icon = icon;
            }
        }
    },

    _registerWindowXId: function(xid, wind, menubarPath, senderDbus) {
        let appTracker = null, appmenuPath = null, windowPath = null, appPath = null;
        let isGtkApp = false;

        if(wind) {
            appTracker = this._tracker.get_window_app(wind);
            if((!menubarPath)||(!senderDbus)) {
                menubarPath = wind.get_gtk_menubar_object_path();
                appmenuPath = wind.get_gtk_app_menu_object_path();
                windowPath  = wind.get_gtk_window_object_path();
                appPath     = wind.get_gtk_application_object_path();
                senderDbus  = wind.get_gtk_unique_bus_name();
                isGtkApp    = (senderDbus != null);
            }
        }

        if (xid in this._registeredWindows) {
            // Firefox use the regitrar iface and also the gtk way, but it unsupported.
            // We ask then for the new data and prevent the override of registrar.
            if(!this._registeredWindows[xid].menubarObjectPath)
                this._registeredWindows[xid].menubarObjectPath = menubarPath;
            if(!this._registeredWindows[xid].appmenuObjectPath)
                this._registeredWindows[xid].appmenuObjectPath = appmenuPath;
            if(!this._registeredWindows[xid].windowObjectPath)
                this._registeredWindows[xid].windowObjectPath = windowPath;
            if(!this._registeredWindows[xid].appObjectPath)
                this._registeredWindows[xid].appObjectPath = appPath;
            if(!this._registeredWindows[xid].sender)
                this._registeredWindows[xid].sender = senderDbus;
            if(!this._registeredWindows[xid].application)
                this._registeredWindows[xid].application = appTracker;
            if(!this._registeredWindows[xid].window)
                this._registeredWindows[xid].window = wind;
        } else {
            this._registeredWindows[xid] = {
                window: wind,
                application: appTracker,
                menubarObjectPath: menubarPath,
                appmenuObjectPath: appmenuPath,
                windowObjectPath: windowPath,
                appObjectPath: appPath,
                sender: senderDbus,
                isGtk: isGtkApp,
                icon: null,
                appMenu: null
            };
        }

        this._tryToGetMenuClient(xid);
    },

    _tryToGetMenuClient: function(xid) {
        this._updateIcon(xid);
        if ((xid in this._registeredWindows) && (!this._registeredWindows[xid].appMenu)) {
            if ((this._registeredWindows[xid].menubarObjectPath) && (this._registeredWindows[xid].sender)) {
                this._getMenuClient(xid, Lang.bind(this, this._onMenuClientReady));
            } else {
                try {
                    let command = "xprop -id " + xid + " -notype _GTK_UNIQUE_BUS_NAME && " +
                                  "xprop -id " + xid + " -notype _GTK_MENUBAR_OBJECT_PATH && " +
                                  "xprop -id " + xid + " -notype _GTK_APP_MENU_OBJECT_PATH && " +
                                  "xprop -id " + xid + " -notype _GTK_WINDOW_OBJECT_PATH && " +
                                  "xprop -id " + xid + " -notype _GTK_APPLICATION_OBJECT_PATH";
                    let terminal = new Utility.TerminalReader(command, Lang.bind(this, this._onTerminalRead));
                    terminal.executeReader();
                } catch(e){
                    global.log("%s Not found properties for %d windows id".format(LOG_NAME, xid));
                }
            } 
        }
    },

    _fillTerminalValues: function(lines, gtkKeys) {
        let lineIndex = 0;
        let result = true;
        let index;
        for (let key in gtkKeys) {
            if(lineIndex < lines.length) {
                index = lines[lineIndex].indexOf(key + " = ");
                if(index == 0)
                    gtkKeys[key] = lines[0].substring(key.length + 4, lines[0].length-1);
                else
                    gtkKeys[key] = null;
            }
        }
    },

    _onTerminalRead: function(command, sucess, result) {
        if(sucess) {
            let xid = parseInt(command.substring(10, command.indexOf(" -notype")));
            let lines = result.split("\n");
            let gtkKeys = { "_GTK_UNIQUE_BUS_NAME":null,
                            "_GTK_MENUBAR_OBJECT_PATH":null,
                            "_GTK_APP_MENU_OBJECT_PATH":null,
                            "_GTK_WINDOW_OBJECT_PATH":null,
                            "_GTK_APPLICATION_OBJECT_PATH":null
                          };
            this._fillTerminalValues(lines, gtkKeys);
            this._registeredWindows[xid].sender = gtkKeys["_GTK_UNIQUE_BUS_NAME"];
            this._registeredWindows[xid].menubarObjectPath = gtkKeys["_GTK_MENUBAR_OBJECT_PATH"];
            this._registeredWindows[xid].appmenuObjectPath = gtkKeys["_GTK_APP_MENU_OBJECT_PATH"];
            this._registeredWindows[xid].windowObjectPath = gtkKeys["_GTK_WINDOW_OBJECT_PATH"];
            this._registeredWindows[xid].appObjectPath = gtkKeys["_GTK_APPLICATION_OBJECT_PATH"];
            this._registeredWindows[xid].isGtk = true;
            if ((this._registeredWindows[xid].sender) && (this._registeredWindows[xid].menubarObjectPath))
                this._getMenuClient(xid, Lang.bind(this, this._onMenuClientReady));
        }
    },

    _onWindowChanged: function() {
        let wind = null;
        let xid = this._guessWindowXId(global.display.focus_window);
        if((xid) && (!(xid in this._registeredWindows) || (!this._registeredWindows[xid].appMenu))) {
            this._registerAllWindows();
        }
        if(xid in this._registeredWindows)
            wind = this._registeredWindows[xid].window;
        this.emit('appmenu-changed', wind);
        this._xidLast = xid;
    },

    // NOTE: we prefer to use the window's XID but this is not stored
    // anywhere but in the window's description being [XID (%10s window title)].
    // And I'm not sure I want to rely on that being the case always.
    // (mutter/src/core/window-props.c)
    //
    // If we use the windows' title, `xprop` grabs the "least-focussed" window
    // (bottom of stack I suppose).
    //
    // Can match winow.get_startup_id() to WM_WINDOW_ROLE(STRING)
    // If they're not equal, then try the XID?
    _guessWindowXId: function (wind) {
        if (!wind)
            return null;

        let id = null;
        // If window title has non-utf8 characters, get_description() complains
        // "Failed to convert UTF-8 string to JS string: Invalid byte sequence in conversion input",
        // event though get_title() works.
        if (wind.get_xwindow)
            return wind.get_xwindow();
        try {
            id = wind.get_description().match(/0x[0-9a-f]+/);
            if (id) {
                return parseInt(id[0], 16);
            }
        } catch (err) {
        }

        // Use xwininfo, take first child.
        let act = wind.get_compositor_private();
        if (act) {
            id = GLib.spawn_command_line_sync('xwininfo -children -id 0x%x'.format(act['x-window']));
            if (id[0]) {
                let str = id[1].toString();

                // The X ID of the window is the one preceding the target window's title.
                // This is to handle cases where the window has no frame and so
                // act['x-window'] is actually the X ID we want, not the child.
                let regexp = new RegExp('(0x[0-9a-f]+) +"%s"'.format(wind.title));
                id = str.match(regexp);
                if (id) {
                    return parseInt(id[1], 16);
                }

                // Otherwise, just grab the child and hope for the best
                id = str.split(/child(?:ren)?:/)[1].match(/0x[0-9a-f]+/);
                if (id) {
                    return parseInt(id[0], 16);
                }
            }
        }
        // Debugging for when people find bugs..
        global.logError("%s Could not find XID for window with title %s".format(LOG_NAME, wind.title));
        return null;
    },

    destroy: function() {
        if (this._registeredWindows) {
            // This doesn't do any sync operation and doesn't allow us to hook up the event of being finished
            // which results in our unholy debounce hack (see extension.js)
            Gio.DBus.session.unown_name(this._ownName);
            this._dbusImpl.unexport();
            if(this._focusWindowId > 0) {
                global.screen.get_display().disconnect(this._focusWindowId);
                this._focusWindowId = 0;
            }
            if(this._notifyWorkspacesId > 0) {
                global.screen.disconnect(this._notifyWorkspacesId);
                this._notifyWorkspacesId = 0;
            }
            if(this._windowsChangedId > 0) {
                this._tracker.disconnect(this._windowsChangedId);
                this._windowsChangedId = 0;
            }
            for (let xid in this._registeredWindows) {
                let register = this._registeredWindows[xid];
                if (register.icon)
                    register.icon.destroy();
                this._destroyMenu(xid);
            }
            this._registeredWindows = null;
            this._system.shellShowAppmenu(false);
            this._system.shellShowMenubar(false);
            this._system.activeUnityMenuProxy(false);
            // FIXME When we can call system.activeUnityGtkModule(false)?
            // Is possible that we need to add an option to the settings
            // to be more easy to the user uninstall the applet
        }
    }
};
Signals.addSignalMethods(IndicatorAppMenuWatcher.prototype);

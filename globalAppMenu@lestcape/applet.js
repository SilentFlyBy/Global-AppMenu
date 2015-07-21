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

const St = imports.gi.St;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Pango = imports.gi.Pango;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Cairo = imports.cairo;
const Gettext = imports.gettext;
const Mainloop = imports.mainloop;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;

const AppletPath = imports.ui.appletManager.applets["globalAppMenu@lestcape"];
const IndicatorAppMenuWatcher = AppletPath.indicatorAppMenuWatcher;
const ConfigurableMenus = AppletPath.configurableMenus;

function _(str) {
   let resultConf = Gettext.dgettext("globalAppMenu@lestcape", str);
   if(resultConf != str) {
      return resultConf;
   }
   return Gettext.gettext(str);
};

function MyMenuFactory() {
   this._init.apply(this, arguments);
}

MyMenuFactory.prototype = {
   __proto__: ConfigurableMenus.MenuFactory.prototype,

   _init: function() {
      ConfigurableMenus.MenuFactory.prototype._init.call(this);
      this._showBoxPointer = true;
      this._openSubMenu = false;
      this._closeSubMenu = false;
      this._floatingMenu = false;
      this._floatingSubMenu = true;
      this._alignSubMenu = false;
      this._showItemIcon = true;
      this._desaturateItemIcon = false;
      this._openOnHover = false;
      this._arrowSide = St.Side.BOTTOM;
      this._effectType = "none";
      this._effectTime = 0.4;
   },

   setMainMenuArrowSide: function(arrowSide) {
      if(this._arrowSide != arrowSide) {
         this._arrowSide = arrowSide;
         for(let pos in this._menuLikend) {
            let shellMenu = this._menuLikend[pos].getShellItem();
            if(shellMenu)
               shellMenu.setArrowSide(this._arrowSide);
         }
      }
   },

   setOpenOnHover: function(openOnHover) {
      if(this._openOnHover != openOnHover) {
         this._openOnHover = openOnHover;
         for(let pos in this._menuLikend) {
            let shellMenu = this._menuLikend[pos].getShellItem();
            if(shellMenu)
               shellMenu.setOpenOnHover(this._openOnHover);
         }
      }
   },

   setEffect: function(effect) {
      if(this._effectType != effect) {
         this._effectType = effect;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setEffect(this._effectType);
         }
      }
   },

   setEffectTime: function(effectTime) {
      if(this._effectTime != effectTime) {
         this._effectTime = effectTime;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setEffectTime(this._effectTime);
         }
      }
   },

   setFloatingState: function(floating) {
      if(this._floatingMenu != floating) {
         this._floatingMenu = floating;
         for(let pos in this._menuLikend) {
            let shellMenu = this._menuLikend[pos].getShellItem();
            if(shellMenu)
               shellMenu.setFloatingState(this._floatingMenu);
         }
      }
   },

   showBoxPointer: function(show) {
      if(this._showBoxPointer != show) {
         this._showBoxPointer = show;
         for(let pos in this._menuManager) {
            this._menuManager[pos].showBoxPointer(this._showBoxPointer);
         }
      }
   },

   setAlignSubMenu: function(align) {
      if(this._alignSubMenu != align) {
         this._alignSubMenu= align;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setAlignSubMenu(this._alignSubMenu);
         }
      }
   },

   setOpenSubMenu: function(openSubMenu) {
      if(this._openSubMenu != openSubMenu) {
         this._openSubMenu = openSubMenu;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setOpenSubMenu(this._openSubMenu);
         }
      }
   },

   setCloseSubMenu: function(closeSubMenu) {
      if(this._closeSubMenu != closeSubMenu) {
         this._closeSubMenu = closeSubMenu;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setCloseSubMenu(this._closeSubMenu);
         }
      }
   },

   setFloatingSubMenu: function(floating) {
      if(this._floatingSubMenu != floating) {
         this._floatingSubMenu = floating;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setFloatingSubMenu(this._floatingSubMenu);
         }
      }
   },

   setShowItemIcon: function(show) {
      if(this._showItemIcon != show) {
         this._showItemIcon = show;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setShowItemIcon(this._showItemIcon);
         }
      }
   },

   desaturateItemIcon: function(desaturate) {
      if(this._desaturateItemIcon != desaturate) {
         this._desaturateItemIcon = desaturate;
         for(let pos in this._menuManager) {
            this._menuManager[pos].desaturateItemIcon(this._desaturateItemIcon);
         }
      }
   },

   _createShellItem: function(factoryItem, launcher, orientation, menuManager) {
      // Decide whether it's a submenu or not
      this._arrowSide = orientation;
      if(menuManager) {
         menuManager.showBoxPointer(this._showBoxPointer);
         menuManager.setOpenSubMenu(this._openSubMenu);
         menuManager.setCloseSubMenu(this._closeSubMenu);
         menuManager.setAlignSubMenu(this._alignSubMenu);
         menuManager.setShowItemIcon(this._showItemIcon);
         menuManager.desaturateItemIcon(this._desaturateItemIcon);
         menuManager.setEffect(this._effectType);
         menuManager.setEffectTime(this._effectTime);
      }
      let shellItem = null;
      let itemType = factoryItem.getFactoryType();
      if(itemType == ConfigurableMenus.FactoryClassTypes.RootMenuClass)
         shellItem = new ConfigurableMenus.ConfigurableMenuApplet(launcher, orientation, menuManager);
      if(itemType == ConfigurableMenus.FactoryClassTypes.SubMenuMenuItemClass)
         shellItem = new ConfigurableMenus.ConfigurablePopupSubMenuMenuItem("FIXME");
      else if(itemType == ConfigurableMenus.FactoryClassTypes.MenuSectionMenuItemClass)
         shellItem = new ConfigurableMenus.ConfigurablePopupMenuSection();
      else if(itemType == ConfigurableMenus.FactoryClassTypes.SeparatorMenuItemClass)
         shellItem = new PopupMenu.PopupSeparatorMenuItem('');
      else if(itemType == ConfigurableMenus.FactoryClassTypes.MenuItemClass)
         shellItem = new ConfigurableMenus.ConfigurableApplicationMenuItem("FIXME");
      //else
      //    throw new TypeError('Trying to instantiate a shell item with an invalid factory type');
      if(itemType == ConfigurableMenus.FactoryClassTypes.RootMenuClass) {
         shellItem.setFloatingState(this._floatingMenu);
         shellItem.setOpenOnHover(this._openOnHover);
      }
      return shellItem;
   }
};

function GradientLabel() {
   this._init.apply(this, arguments);
}

GradientLabel.prototype = {
   _init: function(text, size) {
      this.text = text;
      this.size = size;

      this.actor = new St.Bin();
      //this.labelActor = new St.Label({ style_class: 'applet-label' });
      this._drawingArea = new St.DrawingArea({ style_class: 'applet-label' });
      this._drawingArea.connect('repaint', Lang.bind(this, this._onRepaint));
      this._drawingArea.connect('style-changed', Lang.bind(this, this._onStyleChanged));
      this.actor.set_child(this._drawingArea);
      this.margin = 2;
   },

   setText: function(text) {
      this.text = text;
      this._updateSize();
   },

   setSize: function(size) {
      this.size = size;
      this._updateSize();
   },

   _onStyleChanged: function() {
      this.themeNode = this._drawingArea.get_theme_node();
      this._updateSize();
   },

   _updateSize: function() {
      if(this.themeNode) {
         let font    = this.themeNode.get_font();
         let context = this._drawingArea.get_pango_context();
         let metrics = context.get_metrics(font, context.get_language());
         let width   = Math.min(this.size, this.text.length) * metrics.get_approximate_char_width() / Pango.SCALE;
         let height  =  font.get_size() / Pango.SCALE;
         this._drawingArea.set_width(width);
         this._drawingArea.set_height(height + 2*this.margin);
         this._drawingArea.queue_repaint();
      }
   },

   _onRepaint: function(area) {
      try {
      let cr = area.get_context();
      let [width, height] = area.get_surface_size();

      let resultText = this.text.substring(0, Math.min(this.size, this.text.length));

      let font = this.themeNode.get_font();
      let context = this._drawingArea.get_pango_context();
      let metrics = context.get_metrics(font, context.get_language());
      let fontSize = height - 2*this.margin;
      let startColor = this.themeNode.get_color('color');

      let weight = Cairo.FontWeight.NORMAL;
      if(font.get_weight() >= 700)
        weight = Cairo.FontWeight.BOLD;
      cr.selectFontFace(font.get_family(), Cairo.FontSlant.NORMAL, weight);
      cr.moveTo(0, height/2 + (metrics.get_descent()/Pango.SCALE) + 1);
      cr.setFontSize(fontSize);

      let shadowPattern = new Cairo.LinearGradient(0, 0, width, height);
      shadowPattern.addColorStopRGBA(0, 0, 0, 0, 1);
      shadowPattern.addColorStopRGBA(1, 0, 0, 0, 0);
      cr.setSource(shadowPattern);

      cr.showText(resultText);
      cr.fill();

      cr.moveTo(1, height/2 + (metrics.get_descent()/Pango.SCALE) + 1);
      cr.setFontSize(fontSize);
      let realPattern = new Cairo.LinearGradient(0, 0, width, height);
      realPattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
      realPattern.addColorStopRGBA(0.5, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
      realPattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, 0);
      cr.setSource(realPattern);

      cr.showText(resultText);
      cr.fill();
      cr.stroke();
      } catch(e) {Main.notify("err"+ e.message)}
   }
};

function CustomKeybindings() {
   this._init.apply(this, arguments);
}

CustomKeybindings.prototype = {
   _init: function(metadata) {
     //this."org.cinnamon.desktop.keybindings";
   },
   
};

function MyApplet() {
   this._init.apply(this, arguments);
}

MyApplet.prototype = {
   __proto__: Applet.Applet.prototype,

   _init: function(metadata, orientation, panelHeight, instanceId) {
      Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);
      try {
         this.uuid = metadata["uuid"];
         this.orientation = orientation;

         this.execInstallLanguage();

         this.set_applet_tooltip(_("Global Application Menu"));

         this.currentWindow = null;
         this.showAppIcon = true;
         this.showAppName = true;
         this.desaturateAppIcon = false;
         this.maxAppNameSize = 10;
         this.automaticActiveMainMenu = true;
         this.openActiveSubmenu = false;
         this.closeActiveSubmenu = false;
         this.showBoxPointer = true;
         this.alignMenuLauncher = false;
         this.showItemIcon = true;
         this.desaturateItemIcon = false;
         this.openOnHover = false;
         this._keybindingTimeOut = 0;
         this.effectType = "none";
         this.effectTime = 0.4;

         this.actorIcon = new St.Bin();

         this.gradient = new GradientLabel("", 10);
         this.actor.add(this.actorIcon, { y_align: St.Align.MIDDLE, y_fill: false });
         this.actor.add(this.gradient.actor, { y_align: St.Align.MIDDLE, y_fill: false });
         this.actor.connect("enter-event", Lang.bind(this, this._onAppletEnterEvent));

         this.menuFactory = new MyMenuFactory();
         this._createSettings();

         this.indicatorDbus = new IndicatorAppMenuWatcher.IndicatorAppMenuWatcher(
                IndicatorAppMenuWatcher.AppmenuMode.MODE_STANDARD, this._getIconSize());

         if(this.indicatorDbus.canWatch()) {
             this.indicatorDbus.watch();
             this.indicatorDbus.connect('appmenu-changed', Lang.bind(this, this._onAppmenuChanged));
         } else {
             Main.notify(_("You need restart your computer, to active the unity-gtk-module"));
         }
      }
      catch(e) {
         Main.notify("Init error %s".format(e.message));
         global.logError("Init error %s".format(e.message));
      }
   },

   _createSettings: function() {
      this.settings = new Settings.AppletSettings(this, this.uuid, this.instance_id);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-app-icon", "showAppIcon", this._onShowAppIconChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "desaturate-app-icon", "desaturateAppIcon", this._onDesaturateAppIconChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-app-name", "showAppName", this._onShowAppNameChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "max-app-name-size", "maxAppNameSize", this._onMaxAppNameSizeChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "automatic-active-mainmenu", "automaticActiveMainMenu", this._automaticActiveMainMenuChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "open-active-submenu", "openActiveSubmenu", this._onOpenActiveSubmenuChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "close-active-submenu", "closeActiveSubmenu", this._onCloseActiveSubmenuChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-boxpointer", "showBoxPointer", this._onShowBoxPointerChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "align-menu-launcher", "alignMenuLauncher", this._onAlignMenuLauncherChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "global-overlay-key", "overlayKey", this._updateKeybinding, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "display-in-panel", "displayInPanel", this._onDisplayInPanelChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-item-icon", "showItemIcon", this._onShowItemIconChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "desaturate-item-icon", "desaturateItemIcon", this._onDesaturateItemIconChanged, null);

      this.settings.bindProperty(Settings.BindingDirection.IN, "activate-on-hover", "openOnHover", this._onOpenOnHoverChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "effect", "effectType", this._onEffectTypeChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "effect-time", "effectTime", this._onEffectTimeChanged, null);

      this._onDisplayInPanelChanged();
      this._onShowAppIconChanged();
      this._onDesaturateAppIconChanged();
      this._onShowAppNameChanged();
      this._onMaxAppNameSizeChanged();
      this._updateKeybinding();

      this._onOpenActiveSubmenuChanged();
      this._onCloseActiveSubmenuChanged();
      this._onShowBoxPointerChanged();
      this._onAlignMenuLauncherChanged();
      this._onShowItemIconChanged();
      this._onDesaturateItemIconChanged();
      this._onOpenOnHoverChanged();
      this._onEffectTypeChanged();
      this._onEffectTimeChanged();
   },

   _updateKeybinding: function() {
      Main.keybindingManager.addHotKey("global-overlay-key", this.overlayKey, Lang.bind(this, function() {
         if(this.menu && !Main.overview.visible && !Main.expo.visible) {
            this.menu.toogleSubmenu(true);
            //this._onAccel();
         }
      }));
   },

   /*_onAccel: function() {
      this.menu.showAccel(true);
      if(this._keybindingTimeOut != 0)
         Mainloop.source_remove(this._keybindingTimeOut);
      this._keybindingTimeOut = Mainloop.timeout_add(500, Lang.bind(this, function() {
         Mainloop.source_remove(this._keybindingTimeOut);
         this._keybindingTimeOut = 0;
         this.menu.showAccel(false);
      }));
   },*/

   _onEffectTypeChanged: function() {
      this.menuFactory.setEffect(this.effectType);
   },

   _onEffectTimeChanged: function() {
      this.menuFactory.setEffectTime(this.effectTime);
   },

   _onOpenOnHoverChanged: function() {
      this.menuFactory.setOpenOnHover(this.openOnHover);
   },

   _onDisplayInPanelChanged: function() {
      this.menuFactory.setFloatingState(!this.displayInPanel);
   },

   _onShowAppIconChanged: function() {
      this.actorIcon.visible = this.showAppIcon;
   },

   _onDesaturateAppIconChanged: function() {
      if(this.desaturateAppIcon)
         this.actorIcon.add_effect_with_name("desaturate", new Clutter.DesaturateEffect());
      else
         this.actorIcon.remove_effect_by_name("desaturate");
   },

   _onShowAppNameChanged: function() {
      this.gradient.actor.visible = this.showAppName;
   },

   _onMaxAppNameSizeChanged: function() {
      this.gradient.setSize(this.maxAppNameSize);
   },

   _automaticActiveMainMenuChanged: function() {
      if(this.automaticActiveMainMenu)
         this._closeMenu();
   },

   _onOpenActiveSubmenuChanged: function() {
      this.menuFactory.setOpenSubMenu(this.openActiveSubmenu);
   },

   _onCloseActiveSubmenuChanged: function() {
      this.menuFactory.setCloseSubMenu(this.closeActiveSubmenu);
   },

   _onShowBoxPointerChanged: function() {
      this.menuFactory.showBoxPointer(this.showBoxPointer);
   },

   _onAlignMenuLauncherChanged: function() {
      this.menuFactory.setAlignSubMenu(this.alignMenuLauncher);
   },

   _onShowItemIconChanged: function() {
      this.menuFactory.setShowItemIcon(this.showItemIcon);
   },

   _onDesaturateItemIconChanged: function() {
      this.menuFactory.desaturateItemIcon(this.desaturateItemIcon);
   },

   _onAppmenuChanged: function(indicator, window) {
      let newLabel = null;
      let newIcon = null;
      let newMenu = null;
      this.currentWindow = window;
      if(window) {
         let app = this.indicatorDbus.getAppForWindow(window);
         if(app) {
            newIcon = this.indicatorDbus.getIconForWindow(window);
            newLabel = app.get_name();
            let dbusMenu = this.indicatorDbus.getMenuForWindow(window);
            if(dbusMenu) {
               newMenu = this.menuFactory.getShellMenu(dbusMenu);
               if(!newMenu) {
                  let menuManager = new ConfigurableMenus.ConfigurableMenuManager(this);
                  newMenu = this.menuFactory.buildShellMenu(dbusMenu, this, this.orientation, menuManager);
               }
            }
         }
      }
      this._tryToShow(newLabel, newIcon, newMenu);
   },

   _tryToShow: function(newLabel, newIcon, newMenu) {
      if((newLabel != null)&&(newIcon != null)) {
         this._changeAppmenu(newLabel, newIcon, newMenu);
      } else  {
         this._cleanAppmenu();
      } 
   },

   _changeAppmenu: function(newLabel, newIcon, newMenu) {
      if(this._isNewMenu(newMenu)) {
         this._closeMenu();
         this.menu = newMenu;
         if((this.menu)&&(!this.menu.isOpen)&&
            (!this.menu.isInFloatingState())&&(this.automaticActiveMainMenu))
            this.menu.open();
      }
      if(this._isNewApp(newLabel, newIcon)) {
         this.gradient.setText(newLabel);
         this.actorIcon.set_child(newIcon);
      }
   },

   _closeMenu: function() {
      if((this.menu)&&(this.menu.isOpen))
         this.menu.close(false, true);
   },

   _cleanAppmenu: function() {
      this._closeMenu();
      this.menu = null;
      this.actorIcon.set_child(null);
      this.gradient.setText("");
   },

   _isNewApp: function(newLabel, newIcon) {
      return ((newIcon != this.actorIcon.get_child())||
              (newLabel != this.gradient.text));
   },

   _isNewMenu: function(newMenu) {
      return (newMenu != this.menu);
   },

   _getIconSize: function() {
      let iconSize;
      let ui_scale = global.ui_scale;
      if(!ui_scale) ui_scale = 1;
      if(this._scaleMode)
         iconSize = this._panelHeight * Applet.COLOR_ICON_HEIGHT_FACTOR / ui_scale;
      else
         iconSize = Applet.FALLBACK_ICON_HEIGHT;
      return iconSize;
   },

   _onAppletEnterEvent: function() {
      if(this.currentWindow)
         this.indicatorDbus.updateMenuForWindow(this.currentWindow);
      if((this.menu)&&(this.menu.isInFloatingState())&&(this.openOnHover))
         this.menu.open(true);
   },

   on_orientation_changed: function(orientation) {
      this.orientation = orientation;
      this.menuFactory.setMainMenuArrowSide(orientation);
   },

   on_panel_height_changed: function() {
      let iconSize = this._getIconSize();
      this.indicatorDbus.setIconSize(iconSize);
   },

   on_applet_removed_from_panel: function() {
      this.indicatorDbus.destroy();
   },

   on_applet_clicked: function(event) {
      if((this.menu) && (event.get_button() == 1)) {
         this.menu.forcedToggle();
         return true;
      }
      return false;
   },

   execInstallLanguage: function() {
      try {
         let shareFolder = GLib.get_home_dir() + "/.local/share/";
         let localeFolder = Gio.file_new_for_path(shareFolder + "locale/");
         let moFolder = Gio.file_new_for_path(shareFolder + "cinnamon/applets/" + this.uuid + "/po/mo/");
         let children = moFolder.enumerate_children('standard::name,standard::type,time::modified',
                                                     Gio.FileQueryInfoFlags.NONE, null);
         let info, child, moFile, moLocale, moPath, src, dest, modified, destModified;
         while((info = children.next_file(null)) != null) {
            modified = info.get_modification_time().tv_sec;
            if(info.get_file_type() == Gio.FileType.REGULAR) {
               moFile = info.get_name();
               if(moFile.substring(moFile.lastIndexOf(".")) == ".mo") {
                  moLocale = moFile.substring(0, moFile.lastIndexOf("."));
                  moPath = localeFolder.get_path() + "/" + moLocale + "/LC_MESSAGES/";
                  src = Gio.file_new_for_path(String(moFolder.get_path() + "/" + moFile));
                  dest = Gio.file_new_for_path(String(moPath + this.uuid + ".mo"));
                  try {
                     if(dest.query_exists(null)) {
                        destModified = dest.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                        if((modified > destModified)) {
                           src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                        }
                     } else {
                         this._makeDirectoy(dest.get_parent());
                         src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                     }
                  } catch(e) {
                     global.logWarning("Error %s".format(e.message));
                  }
               }
            }
         }
         Gettext.bindtextdomain(this.uuid, localeFolder.get_path());
      } catch(e) {
         global.logWarning("Error %s".format(e.message));
      }
   },

   _isDirectory: function(fDir) {
      try {
         let info = fDir.query_filesystem_info("standard::type", null);
         if((info)&&(info.get_file_type() != Gio.FileType.DIRECTORY))
            return true;
      } catch(e) {
      }
      return false;
   },

   _makeDirectoy: function(fDir) {
      if(!this._isDirectory(fDir))
         this._makeDirectoy(fDir.get_parent());
      if(!this._isDirectory(fDir))
         fDir.make_directory(null);
   },
};

function main(metadata, orientation, panel_height, instance_id) {
   let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
   return myApplet;
}

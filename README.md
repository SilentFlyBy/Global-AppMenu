Cinnamon Applet: Global Application Menu Version: v0.2-Beta

Last update: 15 may 2015

This is not true at all. I'm no developer of Cinnamon or Mint:
http://compizomania.blogspot.com/2015/05/cinnamon.html


***
Special thanks to:

- rgcjonas             (https://github.com/rgcjonas)               The initial code.
- Canonical devs       (http://www.canonical.com/)                 The protocols and patches.
- Cinnamon devs        (https://github.com/linuxmint/Cinnamon)     The support (specially: https://github.com/mtwebster).
- rilian-la-te         (https://github.com/rilian-la-te)           Understand and fix a lot of things.

--------------
![](https://raw.githubusercontent.com/lestcape/Global-AppMenu/master/globalAppMenu%40lestcape/Capture.png)

Description
--------------
This applet integrates the Ubuntu Application Menu (Global Menu) support into the Cinnamon Desktop.

It's used the same idea of the Gnome Shell extension made by rgcjonas:

https://github.com/rgcjonas/gnome-shell-extension-appindicator

Known issues (Try at your own risk):
--------------
* The applet could takes ages to load and can freeze Cinnamon forever. This is probably caused by the insane amount of embedded PNG icons. 
* There are some unsupported application that can not be integrate into the applet, like Firefox, as is dropping the menu after some time.

http://stackoverflow.com/questions/30206099/what-is-the-current-behavior-of-firefox-for-the-ubuntu-menu-bar

Change log
--------------
0.2-Beta
  - Not crash Cinnamon when firefox drop the menu.
  - Fix xchat and possible other gtk applications.

0.1-Beta
  - Initial release.

This program is free software:
--------------
You can redistribute it and/or modify it under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.
If not, see http://www.gnu.org/licenses/.

Guidelines for bug reports
--------------
Unfortunately, this applet is not completely bug free and will probably never be.
In order to successfully resolve the issues you need to provide some data:

* Your distribution, Cinnamon version and applet version (something like "latest git" or "latest from spices" is sufficient).
* Instructions how to reproduce it. **This is the single most important point**. Bugs that [can't be reproduced](http://xkcd.com/583/) can't be fixed either.
* Bugs which don't provide the necessary information may be closed as "invalid" without prior notice.

To report bugs, request new features and make suggestions, please visit:

https://github.com/lestcape/Global-AppMenu/issues

You can also send us a pull request:

https://github.com/lestcape/Global-AppMenu/pulls

Installation instructions:
--------------
1. Install the unity-gtk-module packages (explanation below).
2. Restart your computer.
3. Download this applet from their website : https://github.com/lestcape/Global-AppMenu
4. Unzip the downloaded file and copy the folder globalAppMenu@lestcape at ~/.local/share/cinnamon/applets/
5. Enable the applet in Cinnamon Settings.
6. Logout and login again.

unity-gtk-module:
--------------
This applet is designed to be used with the standars gtk modules packages (https://launchpad.net/unity-gtk-module) and patches that Ubuntu provide to
be used on Unity desktop.

Thats then will depend of your specific distro and possible you will need to use some equivalent different packages.

* Ubuntu users, be happy, you don't need to do anything if unity is working. :)
* Mint users, all Ubuntu packages that we needed are availables on Mint repositories as well and can be installed.
  - Minimum requirements: sudo apt-get install unity-gtk2-module unity-gtk3-module
* Arch users, you will need to use the rilian-la-te source (https://aur.archlinux.org/packages/?SeB=m&K=rilian).

This applet can only read the standard Dbus menu structure (Gtk/Kde), so we can not resolve or patch directly any problematic application that not export the menu, or if is not exported properly. We also can not do anything if you used an alternative internally implementation that not export the DBus menu structure for some applications. 

We are happy to include the support to any alternative implementation, if is provided an appropriate Dbus menu structure.

Uninstall instructions:
--------------
1. Disable the applet.
2. Reset the gsettings values:

  * gsettings reset org.cinnamon.settings-daemon.plugins.xsettings overrides
  * gsettings reset org.cinnamon.settings-daemon.plugins.xsettings enabled-gtk-modules

3. If you don't use unity desktop, remove also the packages that you install.
Restart your computer.

==============
Thank you very much for using this product.
Lester.

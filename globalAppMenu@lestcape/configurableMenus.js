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

const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
//const BoxPointer = imports.ui.boxpointer;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Main = imports.ui.main;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Tweener = imports.ui.tweener;
const Lang = imports.lang;
const Params = imports.misc.params;
const Signals = imports.signals;
const Mainloop = imports.mainloop;
const DND = imports.ui.dnd;

const POPUP_ANIMATION_TIME = 0.15;

const OrnamentType = PopupMenu.Ornament ? PopupMenu.Ornament : {
   NONE:  0,
   CHECK: 1,
   DOT:   2,
   ICON:  3
};

const FactoryClassTypes = {
   'RootMenuClass'            : "RootMenuClass",
   'MenuItemClass'            : "MenuItemClass",
   'SubMenuMenuItemClass'     : "SubMenuMenuItemClass",
   'MenuSectionMenuItemClass' : "MenuSectionMenuItemClass",
   'SeparatorMenuItemClass'   : "SeparatorMenuItemClass"
};

const FactoryEventTypes = {
   'opened'    : "opened",
   'closed'    : "closed",
   'clicked'   : "clicked"
};

/**
 * BoxPointer:
 * @side: side to draw the arrow on
 * @binProperties: Properties to set on contained bin
 *
 * An actor which displays a triangle "arrow" pointing to a given
 * side.  The .bin property is a container in which content can be
 * placed.  The arrow position may be controlled via setArrowOrigin().
 *
 */
function BoxPointer(side, binProperties) {
    this._init(side, binProperties);
}

BoxPointer.prototype = {
    _init: function(arrowSide, binProperties) {
        this._arrowSide = arrowSide;
        this._arrowOrigin = 0;
        this.actor = new St.Bin({ x_fill: true,
                                  y_fill: true });
        this._container = new Cinnamon.GenericContainer();
        this.actor.set_child(this._container);
        this._container.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._container.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._allocate));
        this.bin = new St.Bin(binProperties);
        this._container.add_actor(this.bin);
        this._border = new St.DrawingArea();
        this._border.connect('repaint', Lang.bind(this, this._drawBorder));
        this._container.add_actor(this._border);
        this.bin.raise(this._border);
        this._xOffset = 0;
        this._yOffset = 0;
        this._xPosition = 0;
        this._yPosition = 0;
        this._sourceAlignment = 0.5;
    },

    show: function(animate, onComplete) {
        let themeNode = this.actor.get_theme_node();
        let rise = themeNode.get_length('-arrow-rise');

        if (animate) {
            this.opacity = 0;
            this.actor.show();
            switch (this._arrowSide) {
                case St.Side.TOP:
                    this.yOffset = -rise;
                    break;
                case St.Side.BOTTOM:
                    this.yOffset = rise;
                    break;
                case St.Side.LEFT:
                    this.xOffset = -rise;
                    break;
                case St.Side.RIGHT:
                    this.xOffset = rise;
                    break;
            }
            Tweener.addTween(this, { opacity: 255,
                                     xOffset: 0,
                                     yOffset: 0,
                                     transition: 'linear',
                                     onComplete: onComplete,
                                     time: POPUP_ANIMATION_TIME });
        } else {
            this.opacity = 255;
            this.actor.show();
        }
    },

    hide: function(animate, onComplete) {
        let xOffset = 0;
        let yOffset = 0;
        let themeNode = this.actor.get_theme_node();
        let rise = themeNode.get_length('-arrow-rise');

        if (animate) {
            switch (this._arrowSide) {
                case St.Side.TOP:
                    yOffset = rise;
                    break;
                case St.Side.BOTTOM:
                    yOffset = -rise;
                    break;
                case St.Side.LEFT:
                    xOffset = rise;
                    break;
                case St.Side.RIGHT:
                    xOffset = -rise;
                    break;
            }
            Tweener.addTween(this, { opacity: 0,
                                     xOffset: xOffset,
                                     yOffset: yOffset,
                                     transition: 'linear',
                                     time: POPUP_ANIMATION_TIME,
                                     onComplete: Lang.bind(this, function () {
                                         this.actor.hide();
                                         this.xOffset = 0;
                                         this.yOffset = 0;
                                         if (onComplete)
                                             onComplete();
                                         })
                                     });
        } else {
            this.actor.hide();
        }
    },

    /**
     * setArrowSide:
     * @side (St.Side): The new side of the menu
     * 
     * Sets the arrow side of the menu. Note that the side is the side
     * of the source actor, not the menu, e.g. If St.Side.TOP is set, 
     * then the menu will appear below the source actor (the source
     * actor will be on top of the menu)
     */
    setArrowSide: function(side) {
	// Need not trigger any other function. Menu position is
        // recalculated every time it is shown
	this._arrowSide = side;
    },

    _adjustAllocationForArrow: function(isWidth, alloc) {
        let themeNode = this.actor.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        alloc.min_size += borderWidth * 2;
        alloc.natural_size += borderWidth * 2;
        if ((!isWidth && (this._arrowSide == St.Side.TOP || this._arrowSide == St.Side.BOTTOM))
            || (isWidth && (this._arrowSide == St.Side.LEFT || this._arrowSide == St.Side.RIGHT))) {
            let rise = themeNode.get_length('-arrow-rise');
            alloc.min_size += rise;
            alloc.natural_size += rise;
        }
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        let [minInternalSize, natInternalSize] = this.bin.get_preferred_width(forHeight);
        alloc.min_size = minInternalSize;
        alloc.natural_size = natInternalSize;
        this._adjustAllocationForArrow(true, alloc);
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this.bin.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        this._adjustAllocationForArrow(false, alloc);
    },

    _allocate: function(actor, box, flags) {
        let themeNode = this.actor.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        let rise = themeNode.get_length('-arrow-rise');
        let childBox = new Clutter.ActorBox();
        let availWidth = box.x2 - box.x1;
        let availHeight = box.y2 - box.y1;

        childBox.x1 = 0;
        childBox.y1 = 0;
        childBox.x2 = availWidth;
        childBox.y2 = availHeight;
        this._border.allocate(childBox, flags);

        childBox.x1 = borderWidth;
        childBox.y1 = borderWidth;
        childBox.x2 = availWidth - borderWidth;
        childBox.y2 = availHeight - borderWidth;
        switch (this._arrowSide) {
            case St.Side.TOP:
                childBox.y1 += rise;
                break;
            case St.Side.BOTTOM:
                childBox.y2 -= rise;
                break;
            case St.Side.LEFT:
                childBox.x1 += rise;
                break;
            case St.Side.RIGHT:
                childBox.x2 -= rise;
                break;
        }
        this.bin.allocate(childBox, flags);

        if (this._sourceActor && this._sourceActor.mapped)
            this._reposition(this._sourceActor, this._arrowAlignment);
    },

    _drawBorder: function(area) {
        let themeNode = this.actor.get_theme_node();

        let borderWidth = themeNode.get_length('-arrow-border-width');
        let base = themeNode.get_length('-arrow-base');
        let rise = themeNode.get_length('-arrow-rise');
        let borderRadius = themeNode.get_length('-arrow-border-radius');

        let halfBorder = borderWidth / 2;
        let halfBase = Math.floor(base/2);

        let borderColor = themeNode.get_color('-arrow-border-color');
        let backgroundColor = themeNode.get_color('-arrow-background-color');

        let [width, height] = area.get_surface_size();
        let [boxWidth, boxHeight] = [width, height];
        if (this._arrowSide == St.Side.TOP || this._arrowSide == St.Side.BOTTOM) {
            boxHeight -= rise;
        } else {
            boxWidth -= rise;
        }
        let cr = area.get_context();
        Clutter.cairo_set_source_color(cr, borderColor);

        // Translate so that box goes from 0,0 to boxWidth,boxHeight,
        // with the arrow poking out of that
        if (this._arrowSide == St.Side.TOP) {
            cr.translate(0, rise);
        } else if (this._arrowSide == St.Side.LEFT) {
            cr.translate(rise, 0);
        }

        let [x1, y1] = [halfBorder, halfBorder];
        let [x2, y2] = [boxWidth - halfBorder, boxHeight - halfBorder];

        cr.moveTo(x1 + borderRadius, y1);
        if (this._arrowSide == St.Side.TOP) {
            if (this._arrowOrigin < (x1 + (borderRadius + halfBase))) {
                cr.lineTo(this._arrowOrigin, y1 - rise);
                cr.lineTo(Math.max(x1 + borderRadius, this._arrowOrigin) + halfBase, y1);
            } else if (this._arrowOrigin > (x2 - (borderRadius + halfBase))) {
                cr.lineTo(Math.min(x2 - borderRadius, this._arrowOrigin) - halfBase, y1);
                cr.lineTo(this._arrowOrigin, y1 - rise);
            } else {
                cr.lineTo(this._arrowOrigin - halfBase, y1);
                cr.lineTo(this._arrowOrigin, y1 - rise);
                cr.lineTo(this._arrowOrigin + halfBase, y1);
            }
        }

        cr.lineTo(x2 - borderRadius, y1);

        // top-right corner
        cr.arc(x2 - borderRadius, y1 + borderRadius, borderRadius,
               3*Math.PI/2, Math.PI*2);

        if (this._arrowSide == St.Side.RIGHT) {
            if (this._arrowOrigin < (y1 + (borderRadius + halfBase))) {
                cr.lineTo(x2 + rise, this._arrowOrigin);
                cr.lineTo(x2, Math.max(y1 + borderRadius, this._arrowOrigin) + halfBase);
            } else if (this._arrowOrigin > (y2 - (borderRadius + halfBase))) {
                cr.lineTo(x2, Math.min(y2 - borderRadius, this._arrowOrigin) - halfBase);
                cr.lineTo(x2 + rise, this._arrowOrigin);
            } else {
                cr.lineTo(x2, this._arrowOrigin - halfBase);
                cr.lineTo(x2 + rise, this._arrowOrigin);
                cr.lineTo(x2, this._arrowOrigin + halfBase);
            }
        }

        cr.lineTo(x2, y2 - borderRadius);

        // bottom-right corner
        cr.arc(x2 - borderRadius, y2 - borderRadius, borderRadius,
               0, Math.PI/2);

        if (this._arrowSide == St.Side.BOTTOM) {
            if (this._arrowOrigin < (x1 + (borderRadius + halfBase))) {
                cr.lineTo(Math.max(x1 + borderRadius, this._arrowOrigin) + halfBase, y2);
                cr.lineTo(this._arrowOrigin, y2 + rise);
            } else if (this._arrowOrigin > (x2 - (borderRadius + halfBase))) {
                cr.lineTo(this._arrowOrigin, y2 + rise);
                cr.lineTo(Math.min(x2 - borderRadius, this._arrowOrigin) - halfBase, y2);
            } else {
                cr.lineTo(this._arrowOrigin + halfBase, y2);
                cr.lineTo(this._arrowOrigin, y2 + rise);
                cr.lineTo(this._arrowOrigin - halfBase, y2);
            }
        }

        cr.lineTo(x1 + borderRadius, y2);

        // bottom-left corner
        cr.arc(x1 + borderRadius, y2 - borderRadius, borderRadius,
               Math.PI/2, Math.PI);

        if (this._arrowSide == St.Side.LEFT) {
            if (this._arrowOrigin < (y1 + (borderRadius + halfBase))) {
                cr.lineTo(x1, Math.max(y1 + borderRadius, this._arrowOrigin) + halfBase);
                cr.lineTo(x1 - rise, this._arrowOrigin);
            } else if (this._arrowOrigin > (y2 - (borderRadius + halfBase))) {
                cr.lineTo(x1 - rise, this._arrowOrigin);
                cr.lineTo(x1, Math.min(y2 - borderRadius, this._arrowOrigin) - halfBase);
            } else {
                cr.lineTo(x1, this._arrowOrigin + halfBase);
                cr.lineTo(x1 - rise, this._arrowOrigin);
                cr.lineTo(x1, this._arrowOrigin - halfBase);
            }
        }

        cr.lineTo(x1, y1 + borderRadius);

        // top-left corner
        cr.arc(x1 + borderRadius, y1 + borderRadius, borderRadius,
               Math.PI, 3*Math.PI/2);

        Clutter.cairo_set_source_color(cr, backgroundColor);
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, borderColor);
        cr.setLineWidth(borderWidth);
        cr.stroke();

        cr.$dispose();
    },

    setPosition: function(sourceActor, alignment) {
        // We need to show it now to force an allocation,
        // so that we can query the correct size.
        this.actor.show();

        this._sourceActor = sourceActor;
        this._arrowAlignment = alignment;

        this._reposition(sourceActor, alignment);
    },

    setSourceAlignment: function(alignment) {
        this._sourceAlignment = alignment;

        if (!this._sourceActor)
            return;

        // We need to show it now to force an allocation,
        // so that we can query the correct size.
        this.actor.show();

        this._reposition(this._sourceActor, this._arrowAlignment);
    },

    _reposition: function(sourceActor, alignment) {
        // Position correctly relative to the sourceActor
        let sourceNode = sourceActor.get_theme_node();
        let sourceContentBox = sourceNode.get_content_box(sourceActor.get_allocation_box());
        let sourceAllocation = Cinnamon.util_get_transformed_allocation(sourceActor);
        let sourceCenterX = sourceAllocation.x1 + sourceContentBox.x1 + (sourceContentBox.x2 - sourceContentBox.x1) * this._sourceAlignment;
        let sourceCenterY = sourceAllocation.y1 + sourceContentBox.y1 + (sourceContentBox.y2 - sourceContentBox.y1) * this._sourceAlignment;
        let [minWidth, minHeight, natWidth, natHeight] = this.actor.get_preferred_size();

        // We also want to keep it onscreen, and separated from the
        // edge by the same distance as the main part of the box is
        // separated from its sourceActor
        let monitor = Main.layoutManager.findMonitorForActor(sourceActor);
        let themeNode = this.actor.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        let arrowBase = themeNode.get_length('-arrow-base');
        let borderRadius = themeNode.get_length('-arrow-border-radius');
        let margin = (4 * borderRadius + borderWidth + arrowBase);
        let halfMargin = margin / 2;

        let themeNode = this.actor.get_theme_node();
        let gap = themeNode.get_length('-boxpointer-gap');

        let resX, resY;

        switch (this._arrowSide) {
        case St.Side.TOP:
            resY = sourceAllocation.y2 + gap;
            break;
        case St.Side.BOTTOM:
            resY = sourceAllocation.y1 - natHeight - gap;
            break;
        case St.Side.LEFT:
            resX = sourceAllocation.x2 + gap;
            break;
        case St.Side.RIGHT:
            resX = sourceAllocation.x1 - natWidth - gap;
            break;
        }

        // Now align and position the pointing axis, making sure
        // it fits on screen
        switch (this._arrowSide) {
        case St.Side.TOP:
        case St.Side.BOTTOM:
            resX = sourceCenterX - (halfMargin + (natWidth - margin) * alignment);

            resX = Math.max(resX, monitor.x + 10);
            resX = Math.min(resX, monitor.x + monitor.width - (10 + natWidth));
            this.setArrowOrigin(sourceCenterX - resX);
            break;

        case St.Side.LEFT:
        case St.Side.RIGHT:
            resY = sourceCenterY - (halfMargin + (natHeight - margin) * alignment);

            resY = Math.max(resY, monitor.y + 10);
            resY = Math.min(resY, monitor.y + monitor.height - (10 + natHeight));

            this.setArrowOrigin(sourceCenterY - resY);
            break;
        }

        let parent = this.actor.get_parent();
        let success, x, y;
        while (!success) {
            [success, x, y] = parent.transform_stage_point(resX, resY);
            parent = parent.get_parent();
        }

        this._xPosition = Math.floor(x);
        this._yPosition = Math.floor(y);
        this._shiftActor();
    },

    // @origin: Coordinate specifying middle of the arrow, along
    // the Y axis for St.Side.LEFT, St.Side.RIGHT from the top and X axis from
    // the left for St.Side.TOP and St.Side.BOTTOM.
    setArrowOrigin: function(origin) {
        if (this._arrowOrigin != origin) {
            this._arrowOrigin = origin;
            this._border.queue_repaint();
        }
    },

    _shiftActor : function() {
        // Since the position of the BoxPointer depends on the allocated size
        // of the BoxPointer and the position of the source actor, trying
        // to position the BoxPoiner via the x/y properties will result in
        // allocation loops and warnings. Instead we do the positioning via
        // the anchor point, which is independent of allocation, and leave
        // x == y == 0.
        this.actor.set_anchor_point(-(this._xPosition + this._xOffset),
                                    -(this._yPosition + this._yOffset));
    },

    set xOffset(offset) {
        this._xOffset = offset;
        this._shiftActor();
    },

    get xOffset() {
        return this._xOffset;
    },

    set yOffset(offset) {
        this._yOffset = offset;
        this._shiftActor();
    },

    get yOffset() {
        return this._yOffset;
    },

    set opacity(opacity) {
        this.actor.opacity = opacity;
    },

    get opacity() {
        return this.actor.opacity;
    }
};

/**
 * ConfigurablePointer
 *
 * The low level class of the floating menu API.
 * The child of the Cinnamon BoxPointer class.
 */
function ConfigurablePointer() {
   this._init.apply(this, arguments);
}

ConfigurablePointer.prototype = {
   __proto__: BoxPointer.prototype,

   _init: function(arrowSide, binProperties) {
      BoxPointer.prototype._init.call (this, arrowSide, binProperties);
      this.actor._delegate = this;
      this._riseArrow = true;
      this._fixCorner = false;
      this._fixScreen = false;
      this._resizeSize = 0;
      this._shiftX = 0;
      this._shiftY = 0;
      this._screenActor = null;
      try {
         let [res, selectedColor] = Clutter.Color.from_string("#505050");
         this._selectedColor = selectedColor;
      } catch (e) {
         let selectedColor = new Clutter.Color();
         selectedColor.from_string("#505050");
         this._selectedColor = selectedColor;
      }
   },

   showArrow: function(show) {
      this._riseArrow = show;
      this._border.queue_repaint();
   },

   fixToScreen: function(actor, fixScreen) {
      this._fixCorner = false;
      this._fixScreen = fixScreen;
      this._screenActor = actor;
      this.trySetPosition(actor, this._arrowAlignment);
      this._border.queue_repaint();
   },

   fixToCorner: function(fixCorner) {
      this._fixScreen = false;
      this._fixCorner = fixCorner;
      if(this._sourceActor)
         this.trySetPosition(this._sourceActor, this._arrowAlignment);
      this._border.queue_repaint();
   },

   setResizeArea: function(resizeSize) {
      this._resizeSize = resizeSize;
      this._border.queue_repaint();
   },

   getCurrentMenuThemeNode: function() {
      return this.themeNode;
   },

   setResizeAreaColor: function(resizeColor) {
      try {
         let [res, selectedColor] = Clutter.Color.from_string(resizeColor);
         this._selectedColor = selectedColor;
      } catch (e) {
         let selectedColor = new Clutter.Color();
         selectedColor.from_string(resizeColor);
         this._selectedColor = selectedColor;
      }
      this._border.queue_repaint();
   },

   trySetPosition: function(sourceActor, alignment) {
      // We need to show it now to force an allocation,
      // so that we can query the correct size.
      //this.actor.show();
      this._sourceActor = sourceActor;
      this._arrowAlignment = alignment;
      if(this.actor.visible) {
         this._reposition(this._sourceActor, this._arrowAlignment);
      }
   },

   shiftPosition: function(x, y) {
      // We need to show it now to force an allocation,
      // so that we can query the correct size.
      //this.actor.show();
      this._shiftX = x;
      this._shiftY = y;
      if(this.actor.visible) {
         this._reposition(this._sourceActor, this._arrowAlignment);
      }
   },

   setArrowSide: function(side) {
      // Need not trigger any other function. Menu position is
      // recalculated every time it is shown
      this._arrowSide = side;
      this._border.queue_repaint();
   },

   _maxPanelSize: function() {
      if(Main.panelManager) {
         if(this._sourceActor) {
            let [x, y] = this._sourceActor.get_transformed_position();
            let i = 0;
            let monitor;
            for(; i < global.screen.get_n_monitors(); i++) {
               monitor = global.screen.get_monitor_geometry(i);
               if(x >= monitor.x && x < monitor.x + monitor.width &&
                  x >= monitor.y && y < monitor.y + monitor.height) {
                  break;
               }
            }
            let maxHeightBottom = 0;
            let maxHeightTop = 0;
            let panels = Main.panelManager.getPanelsInMonitor(i);
            for(let j in panels) {
               if(panels[j].bottomPosition)
                  maxHeightBottom = Math.max(maxHeightBottom, panels[j].actor.height);
               else
                  maxHeightTop = Math.max(maxHeightTop, panels[j].actor.height);
            }
            return [maxHeightBottom, maxHeightTop];
         }
      } else {
         if(!Main.panel2) {
            if(this._arrowSide == St.Side.TOP)
               return [0, Main.panel.actor.height];
            else
               return [Main.panel.actor.height, 0];
         }
         return [Main.panel2.actor.height, Main.panel.actor.height];
      }
      return 0;
   },

   _fixToCorner: function(x, y, sourceActor, sourceAllocation, monitor, maxPHV, gap, borderWidth) {
      let [ax, ay] = sourceActor.get_transformed_position();
      if(((this._fixScreen)||(this._fixCorner))/*&&(ay + this.actor.height + gap  < monitor.y + monitor.height - maxPHV)*/) {
         if((this._arrowSide == St.Side.TOP)||(this._arrowSide == St.Side.BOTTOM)) {
            if(sourceAllocation.x1 < monitor.x + monitor.width/2) {
               if(this._fixScreen) {
                  this._xOffset = -x;
               } else {
                  this._xOffset = -x + ax;
               }
            } else {
               if((this._fixScreen)||(Math.abs(monitor.x + monitor.width - sourceAllocation.x2) < 10)) {
                  this._xOffset = -x + monitor.x + monitor.width - this.actor.width;
               } else if(this._fixCorner) {
                  this._xOffset = -x + ax - this.actor.width + sourceActor.width;
               }
               this.setArrowOrigin(this.actor.width - sourceActor.width/2);
            }
            if(this._arrowSide == St.Side.TOP) {//kicker warning
               let borderTop = this.themeNode.get_length('border-top');
               this._yOffset = -borderTop - gap + borderWidth;
            } else if(this._arrowSide == St.Side.BOTTOM) {
               let borderBottom = this.themeNode.get_length('border-bottom');
               this._yOffset = borderBottom + gap;
               if(this._fixScreen)
                  this._yOffset += 3;
            }
         } else {
            if(this._fixScreen) {
               let allocScreen = Cinnamon.util_get_transformed_allocation(this._screenActor);
               this._xOffset = - x + allocScreen.x1 + this._screenActor.width;
               this._yOffset = - y + allocScreen.y1;
            } else if(this._fixCorner) {
               if(sourceAllocation.y2 < monitor.y + monitor.height)
                   this._yOffset = - y + sourceAllocation.y1;
            }
         }
      } else {
         this._xOffset = 0;
         this._yOffset = 0;
      }
   },

   _shiftActor : function() {
      // Since the position of the BoxPointer depends on the allocated size
      // of the BoxPointer and the position of the source actor, trying
      // to position the BoxPoiner via the x/y properties will result in
      // allocation loops and warnings. Instead we do the positioning via
      // the anchor point, which is independent of allocation, and leave
      // x == y == 0.
      this.actor.set_anchor_point(-(Math.floor(this._xPosition + this._shiftX + this._xOffset)),
                                  -(Math.floor(this._yPosition + this._shiftY + this._yOffset)));
      this._border.queue_repaint();
   },

   _getTopMenu: function(actor) {
      while(actor) {
         if((actor._delegate) && (actor._delegate instanceof PopupMenu.PopupMenu))
            return actor._delegate;
         actor = actor.get_parent();
      }
      return null;
   },

   _reposition: function(sourceActor, alignment) {
       if(!sourceActor)
          sourceActor = this._sourceActor;
       if(!alignment)
          alignment = this._arrowAlignment;
      if(!sourceActor) Main.notify("Error")
      // Position correctly relative to the sourceActor
      let themeNode = sourceActor.get_theme_node();
      let sourceContentBox = themeNode.get_content_box(sourceActor.get_allocation_box());
      let sourceAllocation = Cinnamon.util_get_transformed_allocation(sourceActor);
      let sourceCenterX = sourceAllocation.x1 + sourceContentBox.x1 + (sourceContentBox.x2 - sourceContentBox.x1) * this._sourceAlignment;
      let sourceCenterY = sourceAllocation.y1 + sourceContentBox.y1 + (sourceContentBox.y2 - sourceContentBox.y1) * this._sourceAlignment;
      let [minWidth, minHeight, natWidth, natHeight] = this.actor.get_preferred_size();

      // We also want to keep it onscreen, and separated from the
      // edge by the same distance as the main part of the box is
      // separated from its sourceActor
      let monitor = Main.layoutManager.findMonitorForActor(sourceActor);
      this.themeNode = this.actor.get_theme_node();
      let borderWidth = this.themeNode.get_length('-arrow-border-width');
      let arrowBase = this.themeNode.get_length('-arrow-base');
      let borderRadius = this.themeNode.get_length('-arrow-border-radius');
      let margin = (4 * borderRadius + borderWidth + arrowBase);
      let halfMargin = margin / 2;

      let gap = this.themeNode.get_length('-boxpointer-gap');

      let resX, resY;
      let maxPHV = 0;

      switch (this._arrowSide) {
      case St.Side.TOP:
          resY = sourceAllocation.y2 + gap;
          break;
      case St.Side.BOTTOM:
          resY = sourceAllocation.y1 - natHeight - gap;
          break;
      case St.Side.LEFT:
          resX = sourceAllocation.x2 + gap;
          break;
      case St.Side.RIGHT:
          resX = sourceAllocation.x1 - natWidth - gap;
          break;
      }

      // Now align and position the pointing axis, making sure
      // it fits on screen
      switch (this._arrowSide) {
      case St.Side.TOP:
      case St.Side.BOTTOM:
         resX = sourceCenterX - (halfMargin + (natWidth - margin) * alignment);
         resX = Math.max(resX, monitor.x + 10);
         resX = Math.min(resX, monitor.x + monitor.width - (10 + natWidth));
         this.setArrowOrigin(sourceCenterX - resX);
         break;

      case St.Side.LEFT:
      case St.Side.RIGHT:
         resY = sourceCenterY - (halfMargin + (natHeight - margin) * alignment);
         let [maxHeightBottom, maxHeightTop] = this._maxPanelSize();
         maxPHV = Math.max(maxHeightBottom, maxHeightTop);
         resY = Math.max(resY, monitor.y + maxPHV);
         let topMenu = this._getTopMenu(sourceActor);
         if(Main.panelManager) {
            if(((maxHeightBottom == 0)||(maxHeightTop==0))&&(topMenu)&&(topMenu._arrowSide == St.Side.TOP)) {
               resY = Math.min(resY, monitor.y + monitor.height - (natHeight));
            } else {
               resY = Math.min(resY, monitor.y + monitor.height - (maxPHV + natHeight));
            }
         } else {
            if((!Main.panel2)&&(topMenu)&&(topMenu._arrowSide == St.Side.TOP)) {
               resY = Math.min(resY, monitor.y + monitor.height - (natHeight));
            } else {
               resY = Math.min(resY, monitor.y + monitor.height - (maxPHV + natHeight));
            }
         }

         this.setArrowOrigin(sourceCenterY - resY);
         break;
      }

      let parent = this.actor.get_parent();
      let success, x, y;
      while(!success) {
         [success, x, y] = parent.transform_stage_point(resX, resY);
         parent = parent.get_parent();
      }
      this._fixToCorner(x, y, sourceActor, sourceAllocation, monitor, maxPHV, gap, borderWidth);
      this._xPosition = x;
      this._yPosition = y;
      this._shiftActor();
   },

   _allocate: function(actor, box, flags) {
      let themeNode = this.actor.get_theme_node();
      let borderWidth = themeNode.get_length('-arrow-border-width');
      let rise = themeNode.get_length('-arrow-rise');
      if(!this._riseArrow) rise = Math.round(rise/2);
      let childBox = new Clutter.ActorBox();
      let availWidth = box.x2 - box.x1;
      let availHeight = box.y2 - box.y1;

      childBox.x1 = 0;
      childBox.y1 = 0;
      childBox.x2 = availWidth;
      childBox.y2 = availHeight;
      this._border.allocate(childBox, flags);

      childBox.x1 = borderWidth;
      childBox.y1 = borderWidth;
      childBox.x2 = availWidth - borderWidth;
      childBox.y2 = availHeight - borderWidth;
      switch (this._arrowSide) {
         case St.Side.TOP:
            childBox.y1 += rise;
            break;
         case St.Side.BOTTOM:
            childBox.y2 -= rise;
            break;
         case St.Side.LEFT:
            childBox.x1 += rise;
            break;
         case St.Side.RIGHT:
            childBox.x2 -= rise;
            break;
      }
      this.bin.allocate(childBox, flags);

      if(this._sourceActor && this._sourceActor.mapped)
         this._reposition(this._sourceActor, this._arrowAlignment);
   },

   _drawBorder: function(area) {
      this.themeNode = this.actor.get_theme_node();

      let borderWidth = this.themeNode.get_length('-arrow-border-width');
      let base = this.themeNode.get_length('-arrow-base');
      let rise = 0;
      if(this._riseArrow)
         rise = this.themeNode.get_length('-arrow-rise');

      let borderRadius = this.themeNode.get_length('-arrow-border-radius');

      let halfBorder = borderWidth / 2;
      let halfBase = Math.floor(base/2);

      let borderColor = this.themeNode.get_color('-arrow-border-color');
      let backgroundColor = this.themeNode.get_color('-arrow-background-color');

      let [width, height] = area.get_surface_size();
      let [boxWidth, boxHeight] = [width, height];
      if(this._arrowSide == St.Side.TOP || this._arrowSide == St.Side.BOTTOM) {
         boxHeight -= rise;
      } else {
         boxWidth -= rise;
      }
      let cr = area.get_context();
      Clutter.cairo_set_source_color(cr, borderColor);

      // Translate so that box goes from 0,0 to boxWidth, boxHeight,
      // with the arrow poking out of that
      if(this._arrowSide == St.Side.TOP) {
         cr.translate(0, rise);
      } else if(this._arrowSide == St.Side.LEFT) {
         cr.translate(rise, 0);
      }

      let [x1, y1] = [halfBorder, halfBorder];
      let [x2, y2] = [boxWidth - halfBorder, boxHeight - halfBorder];

      cr.moveTo(x1 + borderRadius, y1);
      if(this._arrowSide == St.Side.TOP) {
         if(this._arrowOrigin < (x1 + (borderRadius + halfBase))) {
            cr.lineTo(this._arrowOrigin, y1 - rise);
            cr.lineTo(Math.max(x1 + borderRadius, this._arrowOrigin) + halfBase, y1);
         } else if(this._arrowOrigin > (x2 - (borderRadius + halfBase))) {
            cr.lineTo(Math.min(x2 - borderRadius, this._arrowOrigin) - halfBase, y1);
            cr.lineTo(this._arrowOrigin, y1 - rise);
         } else {
            cr.lineTo(this._arrowOrigin - halfBase, y1);
            cr.lineTo(this._arrowOrigin, y1 - rise);
            cr.lineTo(this._arrowOrigin + halfBase, y1);
         }
      }

      cr.lineTo(x2 - borderRadius, y1);

      // top-right corner
      cr.arc(x2 - borderRadius, y1 + borderRadius, borderRadius,
             3*Math.PI/2, Math.PI*2);

      if(this._arrowSide == St.Side.RIGHT) {
         if(this._arrowOrigin < (y1 + (borderRadius + halfBase))) {
            cr.lineTo(x2 + rise, this._arrowOrigin);
            cr.lineTo(x2, Math.max(y1 + borderRadius, this._arrowOrigin) + halfBase);
         } else if(this._arrowOrigin > (y2 - (borderRadius + halfBase))) {
            cr.lineTo(x2, Math.min(y2 - borderRadius, this._arrowOrigin) - halfBase);
            cr.lineTo(x2 + rise, this._arrowOrigin);
         } else {
            cr.lineTo(x2, this._arrowOrigin - halfBase);
            cr.lineTo(x2 + rise, this._arrowOrigin);
            cr.lineTo(x2, this._arrowOrigin + halfBase);
         }
      }

      cr.lineTo(x2, y2 - borderRadius);

      // bottom-right corner
      cr.arc(x2 - borderRadius, y2 - borderRadius, borderRadius,
             0, Math.PI/2);

      if(this._arrowSide == St.Side.BOTTOM) {
         if(this._arrowOrigin < (x1 + (borderRadius + halfBase))) {
            cr.lineTo(Math.max(x1 + borderRadius, this._arrowOrigin) + halfBase, y2);
            cr.lineTo(this._arrowOrigin, y2 + rise);
         } else if(this._arrowOrigin > (x2 - (borderRadius + halfBase))) {
            cr.lineTo(this._arrowOrigin, y2 + rise);
            cr.lineTo(Math.min(x2 - borderRadius, this._arrowOrigin) - halfBase, y2);
         } else {
            cr.lineTo(this._arrowOrigin + halfBase, y2);
            cr.lineTo(this._arrowOrigin, y2 + rise);
            cr.lineTo(this._arrowOrigin - halfBase, y2);
         }
      }

      cr.lineTo(x1 + borderRadius, y2);

      // bottom-left corner
      cr.arc(x1 + borderRadius, y2 - borderRadius, borderRadius,
             Math.PI/2, Math.PI);

      if(this._arrowSide == St.Side.LEFT) {
         if(this._arrowOrigin < (y1 + (borderRadius + halfBase))) {
            cr.lineTo(x1, Math.max(y1 + borderRadius, this._arrowOrigin) + halfBase);
            cr.lineTo(x1 - rise, this._arrowOrigin);
         } else if(this._arrowOrigin > (y2 - (borderRadius + halfBase))) {
            cr.lineTo(x1 - rise, this._arrowOrigin);
            cr.lineTo(x1, Math.min(y2 - borderRadius, this._arrowOrigin) - halfBase);
         } else {
            cr.lineTo(x1, this._arrowOrigin + halfBase);
            cr.lineTo(x1 - rise, this._arrowOrigin);
            cr.lineTo(x1, this._arrowOrigin - halfBase);
         }
      }

      cr.lineTo(x1, y1 + borderRadius);

      // top-left corner
      cr.arc(x1 + borderRadius, y1 + borderRadius, borderRadius,
             Math.PI, 3*Math.PI/2);

      Clutter.cairo_set_source_color(cr, backgroundColor);
      cr.fillPreserve();
      Clutter.cairo_set_source_color(cr, borderColor);
      cr.setLineWidth(borderWidth);
      cr.stroke();

      if(this._resizeSize > 0) {
         let maxSpace = Math.max(this._resizeSize, borderRadius);
         let monitor = Main.layoutManager.findMonitorForActor(this._sourceActor);
         let sourceAllocation = Cinnamon.util_get_transformed_allocation(this._sourceActor);
         let actorAllocation = Cinnamon.util_get_transformed_allocation(this.actor);

         if(this._arrowSide == St.Side.BOTTOM) {
            if(sourceAllocation.x1 < (monitor.x + monitor.width/2)) {
               //this._relativeSide = St.Side.LEFT;
               cr.moveTo(x2 - maxSpace - borderWidth, y1 - borderWidth);
               cr.lineTo(x2 + borderWidth, y1 + maxSpace + borderWidth);
               cr.lineTo(x2 + borderWidth, y1 - borderWidth);
               cr.lineTo(x2 - maxSpace - borderWidth, y1 - borderWidth);
            } else {
               this._relativeSide = St.Side.RIGHT;
               cr.moveTo(x1 + maxSpace + borderWidth, y1 - borderWidth);
               cr.lineTo(x1 - borderWidth, y1 + maxSpace + borderWidth);
               cr.lineTo(x1 - borderWidth, y1 - borderWidth);
               cr.lineTo(x1 + maxSpace + borderWidth, y1 - borderWidth);
            }
         } else if(this._arrowSide == St.Side.TOP) {
            if(sourceAllocation.x1 < (monitor.x + monitor.width/2)) {
               //this._relativeSide = St.Side.LEFT;
               cr.moveTo(x2 + borderWidth, y2 - maxSpace - borderWidth);
               cr.lineTo(x2 - maxSpace - borderWidth, y2 + borderWidth);
               cr.lineTo(x2 + borderWidth, y2 + borderWidth);
               cr.lineTo(x2 + borderWidth, y2 - maxSpace - borderWidth);
            } else {
               this._relativeSide = St.Side.RIGHT;
               cr.moveTo(x1 - borderWidth, y2 - maxSpace - borderWidth);
               cr.lineTo(x1 + maxSpace + borderWidth, y2 + borderWidth);
               cr.lineTo(x1 - borderWidth, y2 + borderWidth);
               cr.lineTo(x1 - borderWidth, y2 - maxSpace - borderWidth);
            }
         } else if(this._arrowSide == St.Side.LEFT) {
            if((actorAllocation.y1 + actorAllocation.y2)/2 < (monitor.y + monitor.height/2)) {
               //this._relativeSide = St.Side.TOP;
               cr.moveTo(x2 + borderWidth, y2 - maxSpace - borderWidth);
               cr.lineTo(x2 - maxSpace - borderWidth, y2 + borderWidth);
               cr.lineTo(x2 + borderWidth, y2 + borderWidth);
               cr.lineTo(x2 + borderWidth, y2 - maxSpace - borderWidth);
            } else {
               //this._relativeSide = St.Side.BOTTOM;
               cr.moveTo(x2 - maxSpace - borderWidth, y1 - borderWidth);
               cr.lineTo(x2 + borderWidth, y1 + maxSpace + borderWidth);
               cr.lineTo(x2 + borderWidth, y1 - borderWidth);
               cr.lineTo(x2 - maxSpace - borderWidth, y1 - borderWidth);
            }
         } else if(this._arrowSide == St.Side.RIGHT) {
            if((actorAllocation.y1 + actorAllocation.y2)/2 < (monitor.y + monitor.height/2)) {
               //this._relativeSide = St.Side.TOP;
               cr.moveTo(x1 - borderWidth, y2 - maxSpace - borderWidth);
               cr.lineTo(x1 + maxSpace + borderWidth, y2 + borderWidth);
               cr.lineTo(x1 - borderWidth, y2 + borderWidth);
               cr.lineTo(x1 - borderWidth, y2 - maxSpace - borderWidth);
            } else {
               //this._relativeSide = St.Side.BOTTOM;
               cr.moveTo(x1 + maxSpace + borderWidth, y1 - borderWidth);
               cr.lineTo(x1 - borderWidth, y1 + maxSpace + borderWidth);
               cr.lineTo(x1 - borderWidth, y1 - borderWidth);
               cr.lineTo(x1 + maxSpace + borderWidth, y1 - borderWidth);
            }
         } else {
           Main.notify("otro" + this._arrowSide)
         }
         Clutter.cairo_set_source_color(cr, this._selectedColor);
         cr.fillPreserve();
         Clutter.cairo_set_source_color(cr, borderColor);
         cr.setLineWidth(1);
         cr.stroke();
      }
   }
};

// http://stackoverflow.com/questions/2049582/how-to-determine-a-point-in-a-triangle
function VectorBoxBlocker() {
   this._init.apply(this, arguments);
}

VectorBoxBlocker.prototype = {
   _init: function(eventBlocker, timeOut) {
      this._timeOut = timeOut;
      this._eventBlocker = eventBlocker;
      if(!this._eventBlocker)
         this._eventBlocker = Clutter.EventType.ENTER;
      if(!this._timeOut)
         this._timeOut = 35;
      this._p0 = { x:0, y:0 };
      this._p1 = { x:0, y:0 };
      this._p2 = { x:0, y:0 };
      this._updateLoopId = 0;
      this._allocationId = 0;
      this._captureEventId = 0;
      this._srcActor = null;
      this._destActor = null;
      this._lastActor = null;
   },

   _updateVector: function(p0x, p0y) {
      if(!this._destActor) return false;
      let [bx, by] = this._destActor.get_transformed_position();
      let [bw, bh] = this._destActor.get_transformed_size();
      let p1x, p1y, p2x, p2y;
      if(p0x > bx + bw) { //rigth
         if(p0y > by + bh) { //bottom
            p1x = bx; p1y = by + bh; p2x = bx + bw; p2y = by;
         } else if(p0y < by) {//top
            p2x = bx; p2y = by; p1x = bx + bw; p1y = by + bh;
         } else if((p0y > by)&&(p0y < by + bh)) {//center
            p2x = bx + bw; p2y = by; p1x = bx + bw; p1y = by + bh;
         } else {//inside
            return false;//error
         }
      } else if(p0x < bx) {//left
         if(p0y > by + bh) { //bottom
            p1x = bx; p1y = by; p2x = bx + bw; p2y = by + bh;
         } else if(p0y < by) {//top
            p2x = bx; p2y = by + bh; p1x = bx + bw; p1y = by;
         } else if((p0y > by)&&(p0y < by + bh)) {//center
            p1x = bx; p1y = by; p2x = bx; p2y = by + bh;
         } else {//inside
            return false;//error
         }
      } else if((p0x > bx)&&(p0x < bx + bw)) { //center
         if(p0y > by + bh) { //bottom
            p1x = bx; p1y = by + bh; p2x = bx + bw; p2y = by + bh;
         } else if(p0y < by) {//top
            p2x = bx; p2y = by; p1x = bx + bw; p1y = by;
         } else {//inside
            return false;//error
         }
      }
      this._p0.x = p0x; this._p0.y = p0y;
      this._p1.x = p1x; this._p1.y = p1y;
      this._p2.x = p2x; this._p2.y = p2y;
      return true;
   },

   _disconnectLoop: function() {
      if(this._updateLoopId > 0) {
         Mainloop.source_remove(this._updateLoopId);
         this._updateLoopId = 0;
      }
   },

   release: function() {
      if(this._captureEventId > 0) {
         global.stage.disconnect(this._captureEventId);
         this._captureEventId = 0;
      }
      if(this._allocationId > 0) {
         this._destActor.disconnect(this._allocationId);
         this._allocationId = 0;
      }
      let oldSrcActor = this._srcActor;
      this._srcActor = null;
      this._destActor = null;
      if((this._lastActor)&&(this._lastActor != oldSrcActor)&&
         (this._lastActor._delegate)&&(this._lastActor._delegate.setActive)&&
         (this._isMouseInsideActor(this._lastActor))) {
         this._lastActor._delegate.setActive(true);
      }
      this._lastActor = null;
   },

   executeInActors: function(srcActor, destActor) {
      if((this._srcActor != srcActor)||(this._destActor != destActor)) {
         this.release();
         this._disconnectLoop();
         this._destActor = destActor;
         this._srcActor = srcActor;
         this._lastActor = null;
         let [mx, my, mask] = global.get_pointer();
         this._updateVector(mx, my);
         this._allocationId = this._destActor.connect('allocation_changed', Lang.bind(this, this._onAllocationChanged));
         this._captureEventId = global.stage.connect('captured-event', Lang.bind(this, this._eventFilter));
      }
   },

   _eventFilter: function(global, event) {
      if((!this._srcActor)||(!this._destActor)||
         (!this._srcActor.visible)||(!this._destActor.visible))
         return false;
      let source = event.get_source();
      let type = event.type();
      let [mx, my] = event.get_coords();
      if(type == this._eventBlocker) {
         if(this._isInsideVectorBox(mx, my)) {
            this._lastActor = source;
            return true;
         }
      } else if(type == Clutter.EventType.MOTION) {
         if(this._srcActor == source)
            this._p0.x = mx; this._p0.y = my; //Update triagle
         this._disconnectLoop();
         this._updateLoopId = Mainloop.timeout_add(this._timeOut, Lang.bind(this, this._tryToRelease));
      }
      return false;
   },

   _onAllocationChanged: function(actor, event) {
      let [mx, my, mask] = global.get_pointer();
      this._updateVector(mx, my);
   },

   _tryToRelease: function() {
      if(!this._isMouseInsideActor(this._srcActor))
         this.release();
      this._updateLoopId = 0;
   },

   _isMouseInsideActor: function(actor) {
      let [mx, my, mask] = global.get_pointer();
      let [ax, ay] = actor.get_transformed_position();
      let [aw, ah] = actor.get_transformed_size();
      if((mx > ax)&&(mx < ax + aw)&&(my > ay)&&(my < ay + ah))
         return true;

      return false;
   },

   _isInsideVectorBox: function(px, py) {
      let s = this._p0.y*this._p2.x - this._p0.x*this._p2.y + (this._p2.y - this._p0.y)*px +
              (this._p0.x - this._p2.x)*py;
      let t = this._p0.x*this._p1.y - this._p0.y*this._p1.x + (this._p0.y - this._p1.y)*px +
              (this._p1.x - this._p0.x)*py;
      if((s >= 0) && (t >= 0)) {
         let area = -this._p1.y*this._p2.x + this._p0.y*(-this._p1.x + this._p2.x) + 
                     this._p0.x*(this._p1.y - this._p2.y) + this._p1.x*this._p2.y;
         return ((s + t) <= area);
      }
      return false;
   },

   destroy: function() {
      this.release();
      this._disconnectLoop();
   }
};

/**
 * ConfigurableMenuManager
 *
 * The class that allow control the configurable menu API.
 */
function ConfigurableMenuManager() {
   this._init.apply(this, arguments);
}

ConfigurableMenuManager.prototype = {
   __proto__: PopupMenu.PopupMenuManager.prototype,

   _init: function(owner) {
      PopupMenu.PopupMenuManager.prototype._init.call (this, owner);
      this._lastMenuTimeOut = 0;
      this._openSubMenu = false;
      this._closeSubMenu = false;
      this._floating = true;
      this._showBoxPointer = true;
      this._alignSubMenu = false;
      this._showItemIcon = true;
      this._desaturateItemIcon = false;
      this._effectType = "none";
      this._effectTime = POPUP_ANIMATION_TIME;
      this._lastMenuClose = null;
   },

   _findMenu: function(item) {
      for (let i = 0; i < this._menus.length; i++) {
         let menudata = this._menus[i];
         if (item == menudata.menu)
            return i;
      }
      return -1;
   },

   addMenu: function(menu, position) {
      if(this._findMenu(menu) == -1) {
         let menudata = {
            menu:               menu,
            openStateChangeId:  menu.connect('open-state-changed', Lang.bind(this, this._onMenuOpenState)),
            childMenuAddedId:   menu.connect('child-menu-added', Lang.bind(this, this._onChildMenuAdded)),
            childMenuRemovedId: menu.connect('child-menu-removed', Lang.bind(this, this._onChildMenuRemoved)),
            destroyId:          menu.connect('destroy', Lang.bind(this, this._onMenuDestroy)),
            enterId:            0,
            leaveId:            0,
            focusInId:          0,
            focusOutId:         0
         };

         if((menu.setFloatingState) && !(menu instanceof ConfigurableMenuApplet))
            menu.setFloatingState(this._floating);
         if(menu.showBoxPointer)
            menu.showBoxPointer(this._showBoxPointer);
         if(menu.fixToCorner)
            menu.fixToCorner(this._alignSubMenu);
         if(menu.setShowItemIcon)
            menu.setShowItemIcon(this._showItemIcon);
         if(menu.desaturateItemIcon)
            menu.desaturateItemIcon(this._desaturateItemIcon);
         if(menu.setEffect)
            menu.setEffect(this._effectType);
         if(menu.setEffectTime)
            menu.setEffectTime(this._effectTime);

         let source = menu.sourceActor;
         if(source) {
            menudata.enterId = source.connect('enter-event', Lang.bind(this, function() { this._onMenuSourceEnter(menu); }));
            menudata.focusInId = source.connect('key-focus-in', Lang.bind(this, function() { this._onMenuSourceEnter(menu); }));
            menudata.leaveId = source.connect('leave-event', Lang.bind(this, function() { this._onMenuSourceLeave(menu); }));
            menudata.focusOutId = source.connect('key-focus-out', Lang.bind(this, function() { this._onMenuSourceLeave(menu); }));
         }

         if(position == undefined)
            this._menus.push(menudata);
         else
            this._menus.splice(position, 0, menudata);

         // We will add all current childrens
         let children = menu._childMenus;
         for(let pos in children)
            this.addMenu(children[pos]);
      }
   },

   setEffect: function(effect) {
      if(this._effectType != effect) {
         this._effectType = effect;
         for(let pos in this._menus) {
            if(this._menus[pos].menu.setEffect)
               this._menus[pos].menu.setEffect(this._effectType);
         }
      }
   },

   setEffectTime: function(effectTime) {
      if(this._effectTime != effectTime) {
         this._effectTime = effectTime;
         for(let pos in this._menus) {
            if(this._menus[pos].menu.setEffectTime)
               this._menus[pos].menu.setEffectTime(this._effectTime);
         }
      }
   },

   setOpenSubMenu: function(openSubMenu) {
      this._disconnectTimeOut();
      this._openSubMenu = openSubMenu;
   },

   setCloseSubMenu: function(closeSubMenu) {
      this._disconnectTimeOut();
      this._closeSubMenu = closeSubMenu;
   },

   showBoxPointer: function(show) {
      if(this._showBoxPointer != show) {
         this._showBoxPointer = show;
         for(let pos in this._menus) {
            if(this._menus[pos].menu.showBoxPointer)
               this._menus[pos].menu.showBoxPointer(this._showBoxPointer);
         }
      }
   },

   setAlignSubMenu: function(align) {
      if(this._alignSubMenu != align) {
         this._alignSubMenu = align;
         for(let pos in this._menus) {
            if(this._menus[pos].menu.fixToCorner)
               this._menus[pos].menu.fixToCorner(this._alignSubMenu);
         }
      }
   },

   setFloatingSubMenu: function(floating) {
      if(this._floating != floating) {
         this._floating = floating;
         for(let pos in this._menus) {
            if(this._menus[pos].menu.setFloatingState)
               this._menus[pos].menu.setFloatingState(this._floating);
         }
      }
   },

   setShowItemIcon: function(show) {
      if(this._showItemIcon != show) {
         this._showItemIcon = show;
         for(let pos in this._menus) {
            if(this._menus[pos].menu.setShowItemIcon)
               this._menus[pos].menu.setShowItemIcon(this._showItemIcon);
         }
      }
   },

   desaturateItemIcon: function(desaturate) {
      if(this._desaturateItemIcon != desaturate) {
         this._desaturateItemIcon = desaturate;
         for(let pos in this._menus) {
            if(this._menus[pos].menu.desaturateItemIcon)
               this._menus[pos].menu.desaturateItemIcon(this._desaturateItemIcon);
         }
      }
   },

   removeMenu: function(menu) {
      if(menu == this._activeMenu)
         this._closeMenu();

      let position = this._findMenu(menu);
      // Not a menu we manage
      if(position == -1) 
         return;

      let menudata = this._menus[position];
      menu.disconnect(menudata.openStateChangeId);
      menu.disconnect(menudata.childMenuAddedId);
      menu.disconnect(menudata.childMenuRemovedId);
      menu.disconnect(menudata.destroyId);

      if(menudata.enterId)
         menu.sourceActor.disconnect(menudata.enterId);
      if(menudata.focusInId)
         menu.sourceActor.disconnect(menudata.focusInId);
      if(menudata.leaveId)
         menu.sourceActor.disconnect(menudata.leaveId);
      if(menudata.focusOutId)
         menu.sourceActor.disconnect(menudata.focusOutId);

      this._menus.splice(position, 1);
   },

   _onMenuOpenState: function(menu, open) {
      if(!this._isFloating(menu))
         return;
      if(open) {
         if(this._activeMenu && this._activeMenu.isChildMenu(menu)) {
            this._menuStack.push(this._activeMenu);
         } else {
            menu.actor.grab_key_focus();
         }
         menu.sourceActor.grab_key_focus();
         this._activeMenu = menu;
      } else if(this._menuStack.length > 0) {
         this._lastMenuClose = menu;
         this._activeMenu = this._menuStack.pop();
      }
      // Check what the focus was before calling pushModal/popModal
      let focus = global.stage.key_focus;
      let hadFocus = focus && this._activeMenuContains(focus);

      if(open) {
         if(!this.grabbed) {
            this._preGrabInputMode = global.stage_input_mode;
            this._grabbedFromKeynav = hadFocus;
            this._grab();
         }
         // FIXME: this is buggy and open the menu and closed it several times.
         //if(hadFocus)
         //   focus.grab_key_focus();
         //else
         //   menu.actor.grab_key_focus();
      } else if(menu == this._activeMenu) {
         if(this.grabbed)
            this._ungrab();
         this._activeMenu = null;

         if(this._grabbedFromKeynav) {
            if(this._preGrabInputMode == Cinnamon.StageInputMode.FOCUSED)
               global.stage_input_mode = Cinnamon.StageInputMode.FOCUSED;
            if(hadFocus && menu.sourceActor)
               menu.sourceActor.grab_key_focus();
            else if(focus)
               focus.grab_key_focus();
         }
      }
   },

   _shouldMadeSourceAction: function(menu) {
      if(!this.grabbed)
         return false;
      if(this._activeMenu && this._activeMenu.isChildMenu(menu))
         return false;
      if(this._menuStack.indexOf(menu) != -1)
         return false;
      return true;
   },

   // Change the currently-open menu without dropping grab
   _changeMenu: function(newMenu) {
      if(this._activeMenu) {
         // _onOpenMenuState will drop the grab if it sees
         // this._activeMenu being closed; so clear _activeMenu
         // before closing it to keep that from happening.
         let pos = this._menuStack.indexOf(newMenu.getTopMenu());
         // We will accepted pos == -1, as we want to close the activemenu also.
         for(let i = this._menuStack.length; i > pos; i--) {
            let oldMenu = this._activeMenu;
            this._activeMenu = null;
            oldMenu.close(false);
         }
         newMenu.open(true);
      } else {
         newMenu.open(true);
      }
   },

   _isFloating: function(menu) {
      return ((menu.isInFloatingState) && (menu.isInFloatingState()));
   },

   _getTopMenu: function(actor) {
      while(actor) {
         if((actor._delegate) && (actor._delegate instanceof PopupMenu.PopupMenu))
            return actor._delegate;
         actor = actor.get_parent();
      }
      return null;
   },

   _onMenuSourceEnter: function(menu) {
      if(this._openSubMenu) {
         if(this.grabbed && this._activeMenu && this._activeMenu.isChildMenu(menu) &&
           (this._lastMenuClose != menu)) {
            this._lastMenuClose = null;
            menu.open(true);
            return false;
         }
         this._lastMenuClose = null;
         if((!this._isFloating(menu)) || (!this._shouldMadeSourceAction(menu)) ||
            ((!this._closeSubMenu)&&(menu == this._activeMenu)))
            return false;
         this._changeMenu(menu);
      }
      return false;
   },

   _onMenuSourceLeave: function(menu) {
      if(this._closeSubMenu) {
         let topMenu = menu.getTopMenu();
         if((this._isFloating(menu)) && (this.grabbed) && (topMenu) && (topMenu.actor.get_parent() == Main.uiGroup)) {
            this._disconnectTimeOut();
            //this._lastMenuTimeOut = Mainloop.timeout_add(500, Lang.bind(this, function() {
            this._lastMenuTimeOut = Mainloop.idle_add(Lang.bind(this, function() {
               this._disconnectTimeOut();
               let focus = global.stage.key_focus;
               if((focus) && (!menu.actor.contains(focus)) && (!menu.sourceActor.contains(focus)))
                  this._onMenuSourceCompleteLeave(menu);
            }));
         }
      }
   },

   _disconnectTimeOut: function() {
      if(this._lastMenuTimeOut > 0) {
         Mainloop.source_remove(this._lastMenuTimeOut);
         this._lastMenuTimeOut = 0;
      }
   },

   _onMenuSourceCompleteLeave: function(menu) {
      if(!this._shouldMadeSourceAction(menu) || menu != this._activeMenu)
         return false;

      if(this._activeMenu) {
         let focus = global.stage.key_focus;
         let hadFocus = focus && this._activeMenuContains(focus);

         let oldMenu = this._activeMenu;
         this._activeMenu = null;
         oldMenu.close(false);
         if(!hadFocus)
            focus.grab_key_focus();
      }
      return false;
   },

   _onKeyFocusChanged: function() {
      if(!this.grabbed || !this._activeMenu || DND.isDragging())
         return;
      let focus = global.stage.key_focus;
      this._onMenuSourceLeave(this._activeMenu);
      if(focus) {
         if(this._activeMenuContains(focus))
            return;
         if(this._menuStack.length > 0)
            return;
         if(focus._delegate && focus._delegate.menu &&
            this._findMenu(focus._delegate.menu) != -1)
            return;
         if(focus._delegate && this._findMenu(focus._delegate) != -1)
            return;
      }
      this._closeMenu();
   },

   // Override allow return false to active the parent menu actions.
   _onEventCapture: function(actor, event) {
      if(!this.grabbed)
         return false;

      if(this._owner.menuEventFilter &&
         this._owner.menuEventFilter(event))
         return true;

      if(this._activeMenu != null && this._activeMenu.passEvents)
         return false;

      if(!this._shouldBlockEvent(event)) {
         return false;
      }

      let eventType = event.type();
      if(eventType == Clutter.EventType.BUTTON_PRESS ||
         eventType == Clutter.EventType.BUTTON_RELEASE) {
         for(let i = this._menuStack.length; i > -1; i--) {
            if(this._activeMenu)
               this._activeMenu.close(false);
         }
         return false;
      }
      return true;
   },

   _shouldBlockEvent: function(event) {
      let src = event.get_source();
      return !this._menusContains(src);
   },

   _menusContains: function(actor) {
      if(this._activeMenu != null && this._activeMenu.actor.contains(actor))
         return true;

      // Override menu.actor.contains(actor)
      for(let i = 0; i < this._menus.length; i++) {
         let menu = this._menus[i].menu;
         if((menu.sourceActor && !menu.blockSourceEvents && menu.sourceActor.contains(actor)) ||
             (menu.actor && menu.actor.contains(actor))) {
            return true;
         }
      }
      return false;
   }
};

/**
 * ConfigurableMenu
 *
 * The class that allow a lot of things on the menu API.
 */
function ConfigurableMenu() {
   this._init.apply(this, arguments);
}

ConfigurableMenu.prototype = {
   // Compatibility reasons
   //__proto__: PopupMenu.PopupMenuBase.prototype,
   //__proto__: PopupMenu.PopupSubMenu.prototype,
   __proto__: PopupMenu.PopupMenu.prototype, 


   _init: function(launcher, arrowAlignment, orientation, floating) {
      PopupMenu.PopupMenuBase.prototype._init.call (this, (launcher ? launcher.actor: null), 'popup-menu-content');
      try {
         this._arrowAlignment = arrowAlignment;
         this._arrowSide = orientation;
         this._effectType = "none";
         this._effectTime = POPUP_ANIMATION_TIME;
         this._automaticOpenControl = true;
         this._paintId = 0;
         this._paintCount = 0;
         this._reactive = true;
         this._floating = false;
         this._topMenu = null;
         this._showItemIcon = true;
         this._desaturateItemIcon = false;

         this.launcher = null;
         this._openedSubMenu = null;

         // Since a function of a submenu might be to provide a "More.." expander
         // with long content, we make it scrollable - the scrollbar will only take
         // effect if a CSS max-height is set on the top menu.
         this._scroll = new St.ScrollView({ style_class: 'popup-sub-menu',
                                            hscrollbar_policy: Gtk.PolicyType.NEVER,
                                            vscrollbar_policy: Gtk.PolicyType.NEVER
                                          });
         this._scroll.clip_to_allocation = true;
         this._scroll._delegate = this;
         this._scroll.hide();
         this._scroll.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

         // StScrollbar plays dirty tricks with events, calling
         // clutter_set_motion_events_enabled (FALSE) during the scroll; this
         // confuses our event tracking, so we just turn it off during the
         // scroll.
         let vscroll = this._scroll.get_vscroll_bar();
         vscroll.connect('scroll-start',
                        Lang.bind(this, function() {
                                      let topMenu = this._topMenu;
                                      if(topMenu)
                                          topMenu.passEvents = true;
                                  }));
         vscroll.connect('scroll-stop',
                        Lang.bind(this, function() {
                                      let topMenu = this._topMenu;
                                      if(topMenu)
                                          topMenu.passEvents = false;
                                  }));


         this._boxPointer = new ConfigurablePointer(orientation,
                                                    { x_fill: true,
                                                      y_fill: true,
                                                      x_align: St.Align.START });
         this._boxPointer.actor._delegate = this;
         this._boxPointer.actor.reactive = true;
         this._boxPointer.actor.set_style_class_name('popup-menu-boxpointer');
         this._boxPointer.actor.add_style_class_name('popup-menu');
         this._boxPointer.actor.hide();
         this._boxPointer.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
         Main.uiGroup.add_actor(this._boxPointer.actor);
         global.focus_manager.add_group(this._boxPointer.actor);

         this._boxWrapper = new Cinnamon.GenericContainer();
         this._boxWrapper.connect('get-preferred-width', Lang.bind(this, this._boxGetPreferredWidth));
         this._boxWrapper.connect('get-preferred-height', Lang.bind(this, this._boxGetPreferredHeight));
         this._boxWrapper.connect('allocate', Lang.bind(this, this._boxAllocate));
         this._boxPointer.bin.set_child(this._boxWrapper);
         this._scroll.add_actor(this.box);

         this._vectorBlocker = new VectorBoxBlocker();

         // Init the launcher and the floating state.
         this.actor = this._scroll;
         this.setFloatingState(floating == true);
         this.setLauncher(launcher);
      } catch(e) {
         Main.notify("ErrorMenuCreation", e.message);
      }
   },

   addMenuItem: function(menuItem, position) {
      this._setShowItemIcon(menuItem);
      this._setDesaturateItemIcon(menuItem);
      this._setVectorBox(menuItem);
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         let beforeItem = null;
         if(position == undefined) {
            this.box.add(menuItem.actor);
         } else {
            let items = this._getMenuItems();
            if(position < items.length) {
               beforeItem = items[position].actor;
               this.box.insert_before(menuItem.actor, beforeItem);
            } else
               this.box.add(menuItem.actor);
         }
         this._connectSubMenuSignals(menuItem, menuItem.menu);
         this._connectItemSignals(menuItem);
         menuItem._closingId = this.connect('open-state-changed', function(self, open) {
            if(!open)
               menuItem.menu.close(false);
         });
         this.addChildMenu(menuItem.menu);
         this._setMenuInPosition(menuItem);
      } else {
         PopupMenu.PopupMenu.prototype.addMenuItem.call(this, menuItem, position);
      }
   },

   addChildMenu: function(menu) {
      if(this.isChildMenu(menu))
         return;

      this._childMenus.push(menu);
      menu.connect('destroy', Lang.bind(this, this.removeChildMenu));
      this.emit('child-menu-added', menu);
   },

   getScale: function(menu) {
      if(global.ui_scale)
         return global.ui_scale;
      return 1;
   },

   _setVectorBox: function(menuItem) {
      if(menuItem.setVectorBox)
         menuItem.setVectorBox(this._vectorBlocker);
   },

   _isFloating: function(menu) {
      return ((menu.isInFloatingState) && (menu.isInFloatingState()));
   },

   _setMenuInPosition: function(menuItem) {
      if((!menuItem.menu.isInFloatingState) || (!menuItem.menu.isInFloatingState())) {
         this.box.insert_before(menuItem.menu.actor, menuItem.actor);
      }
   },

   setShowItemIcon: function(show) {
      if(this._showItemIcon != show) {
         this._showItemIcon = show;
         let items = this._getMenuItems();
         for(let pos in items) {
            let menuItem = items[pos];
            this._setShowItemIcon(menuItem);
         }
      }
   },

   desaturateItemIcon: function(desaturate) {
      if(this._desaturateItemIcon != desaturate) {
         this._desaturateItemIcon = desaturate;
         let items = this._getMenuItems();
         for(let pos in items) {
            let menuItem = items[pos];
            this._setDesaturateItemIcon(menuItem);
         }
      }
   },

   _setDesaturateItemIcon: function(menuItem) {
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         if(menuItem.menu.desaturateItemIcon)
             menuItem.menu.desaturateItemIcon(this._desaturateItemIcon);
      }
      if(menuItem.desaturateItemIcon)
          menuItem.desaturateItemIcon(this._desaturateItemIcon);
   },

   _setShowItemIcon: function(menuItem) {
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         if(menuItem.menu.setShowItemIcon)
             menuItem.menu.setShowItemIcon(this._showItemIcon);
      }
      if(menuItem.setShowItemIcon)
         menuItem.setShowItemIcon(this._showItemIcon);
   },

   setMenuReactive: function(reactive) {
      this._reactive = reactive;
   },

   setFloatingState: function(floating) {
      this.close();
      if(this._floating != floating) {
         this._floating = floating;
         this._boxPointer.actor.hide();
         this._scroll.hide();
         this._releaseActorState();
         if(this._floating) {
            this._scroll.set_style_class_name('popup-menu');
            this._boxWrapper.add_actor(this._scroll);
            this.actor = this._boxPointer.actor;
            this._scroll.show();
         } else {
            this._scroll.set_style_class_name('popup-sub-menu'); 
            this.actor = this._scroll;
            //this._insertMenuOnLauncher();
         }
      }
      this._updateTopMenu();
   },

   isInFloatingState: function(animate) {
       return this._floating;
   },

   setLauncher: function(launcher) {
      this.close();      
      this.launcher = launcher;
      if(this.launcher) {
         this.sourceActor = this.launcher.actor;
         this._boxPointer.trySetPosition(this.launcher.actor, this._arrowAlignment);
         this._updateTopMenu();
      }
   },

   _insertMenuOnLauncher: function() {
      if((this.launcher)&&(!this._floating)) {
         let box = null;
         if(this.launcher.box)
            box = this.launcher.box;
         else
            box = this.launcher.actor;
         let parent = this.actor.get_parent();
         if((box)&&(box != parent)) {
            if(parent)
               parent.remove_actor(this.actor);
            if((box._delegate)&&(box._delegate instanceof PopupMenu.PopupMenuBase)) {
                let items = box._delegate._getMenuItems();
                let position = items.indexOf(this.launcher) + 1;
                if((position != 0) && (position < items.length)) {
                    let beforeItem = items[position].actor;
                    box.insert_before(this.actor, beforeItem);
                } else {
                    box.add(this.actor);
                }
            } else {
                if(box.add) {
                   box.add(this.actor);
                } else if(box.addActor) {
                   box.addActor(this.actor);
                }
            }
         }
      }
   },

   setAutomaticOpenControl: function(active) {
      if(this._automaticOpenControl != active) {
          this._automaticOpenControl = active;
          if(!this._automaticOpenControl) {
             if(Main.popup_rendering)
                Main.popup_rendering = false;
             if(this._paintId > 0)
                this.actor.disconnect(this._paintId);
             this._paintId = 0;
          }
      }
   },

   isInPosition: function(actor) {
      return actor == this._boxPointer._sourceActor;
   },

   _on_paint: function(actor) {
      if(this._paintCount < 2 || this.animating) {
         this._paintCount++;
         return;
      }

      if(this._paintId > 0) {
         this.actor.disconnect(this._paintId);
         this._paintId = 0;
      }

      this._paintCount = 0;
      Main.popup_rendering = false;
   },

   setEffect: function(effect) {
      this._effectType = effect;
   },

   setEffectTime: function(effectTime) {
      this._effectTime = effectTime;
   },

   setArrowSide: function(side) {
      if(this._arrowSide != side) {
         this._arrowSide = side;
         this._boxPointer.setArrowSide(this._arrowSide);
         if((this.launcher instanceof PopupMenu.PopupSubMenuMenuItem)&&(this.launcher.setArrowSide)) {
            this.launcher.setArrowSide(this._arrowSide);
         }
      }
   },

   _setChildsArrowSide: function() {
      let monitor = Main.layoutManager.findMonitorForActor(this.actor);
      if(monitor) {
         let leftEdge = monitor.x;
         let rightEdge = leftEdge + monitor.width;
         let [leftMenu, ay] = this.actor.get_transformed_position();
         leftMenu = leftMenu - 20;
         let rightMenu = leftMenu + this.actor.width + 20;
         let childArrowSide = St.Side.LEFT;
         if(this._arrowSide == St.Side.RIGHT)
            childArrowSide = this._arrowSide;
         else if((this._arrowSide == St.Side.TOP) || (this._arrowSide == St.Side.BOTTOM)) {
            if(leftMenu + this.actor.width/2 > leftEdge + rightEdge/2)
               childArrowSide = St.Side.RIGHT;
         }
         for(let pos in this._childMenus) {
            let menu = this._childMenus[pos];
            if(menu.actor) {
               if((childArrowSide == St.Side.LEFT) && (rightMenu + menu.actor.width  > rightEdge)) {
                  childArrowSide = St.Side.RIGHT;
               } else if((childArrowSide == St.Side.RIGHT) && (leftMenu - menu.actor.width < leftEdge)) {
                  childArrowSide = St.Side.LEFT;
               }
               menu.setArrowSide(childArrowSide);
            }
         }
      } else {
         global.logError("Fail to get the monitor for oriented the arrow child side.");
      }
   },

   _boxGetPreferredWidth: function (actor, forHeight, alloc) {
      let columnWidths = this.getColumnWidths();
      this.setColumnWidths(columnWidths);
      // Now they will request the right sizes
      [alloc.min_size, alloc.natural_size] = this._scroll.get_preferred_width(forHeight);
   },

   _boxGetPreferredHeight: function (actor, forWidth, alloc) {
      [alloc.min_size, alloc.natural_size] = this._scroll.get_preferred_height(forWidth);
   },

   _boxAllocate: function (actor, box, flags) {
      this._scroll.allocate(box, flags);
   },

   _onKeyPressEvent: function(actor, event) {
      if(this.isOpen) {
         let close = false;
         if(event.get_key_symbol() == Clutter.Escape)
            close = true;
         else if(event.get_key_symbol() == this._getClutterScapeKey()) {
            let topMenu = this.getTopMenu();
            if(topMenu)
               topMenu.actor.grab_key_focus();
            if((!topMenu) || (this._isFloating(topMenu)))
               close = true;
         }
         if(close) {
            this.close(true);
            if((this.launcher)&&(this.launcher.setActive))
               this.launcher.setActive(true);
            return true;
         }
      }
      return false;
   },

   _getClutterScapeKey: function() {
      let scapeKey = null;
      if(this._arrowSide == St.Side.LEFT)
         scapeKey = Clutter.KEY_Left;
      else if(this._arrowSide == St.Side.RIGHT)
         scapeKey = Clutter.KEY_Right;
      else if(this._getBorderMenuItem(this) == this._activeMenuItem) {
         if(this._arrowSide == St.Side.TOP)
            scapeKey = Clutter.KEY_Up;
         else if(this._arrowSide == St.Side.BOTTOM)
            scapeKey = Clutter.KEY_Down;
      }
      return scapeKey;
   },

   _getBorderMenuItem: function(menu) {
      if(this._arrowSide == St.Side.TOP)
         return this._getFirstMenuItem(menu);
      else if(this._arrowSide == St.Side.BOTTOM)
         return this._getLastMenuItem(menu);
      return true;
   },

   _getFirstMenuItem: function(menu) {
      let items = menu._getAllMenuItems();
      for(let pos in items) {
         if(items[pos]._getAllMenuItems) {
            let result = this._getFirstMenuItem(items[pos]);
            if(result)
               return result;
         } else if((items[pos].actor.visible)&&(items[pos].sensitive)&&
                   (!(items[pos] instanceof PopupMenu.PopupSeparatorMenuItem))) {
            return items[pos];
         }
      }
      return null;
   },

   _getLastMenuItem: function(menu) {
      let items = menu._getAllMenuItems();
      for(let pos = items.length - 1; pos > -1; pos--) {
         if(items[pos]._getAllMenuItems) {
            let result = this._getLastMenuItem(items[pos]);
            if(result)
               return result;
         } else if((items[pos].actor.visible)&&(items[pos].sensitive)&&
                   (!(items[pos] instanceof PopupMenu.PopupSeparatorMenuItem))) {
            return items[pos];
         }
      }
      return null;
   },


   _getAllMenuItems: function() {
      return this.box.get_children().map(function (actor) {
         return actor._delegate;
      });
   },

   setArrowOrigin: function(origin) {
      this._boxPointer.setArrowOrigin(origin);
   },

   setSourceAlignment: function(alignment) {
      this._boxPointer.setSourceAlignment(alignment);
   },

   // Setting the max-height won't do any good if the minimum height of the
   // menu is higher then the screen; it's useful if part of the menu is
   // scrollable so the minimum height is smaller than the natural height
   setMaxHeight: function() {
      let scale = this.getScale();
      if(Main.panelManager) {
         let [x, y] = this.launcher.actor.get_transformed_position();

         let i = 0;
         let monitor;
         for(; i < global.screen.get_n_monitors(); i++) {
            monitor = global.screen.get_monitor_geometry(i);
            if(x >= monitor.x && x < monitor.x + monitor.width &&
               x >= monitor.y && y < monitor.y + monitor.height) {
               break;
            }
         }

         let maxHeight = monitor.height - this.actor.get_theme_node().get_length('-boxpointer-gap');

         let panels = Main.panelManager.getPanelsInMonitor(i);
         for(let j in panels) {
            maxHeight -= panels[j].actor.height;
         }
         this.actor.style = ('max-height: ' + maxHeight / scale + 'px;');
      } else {
         let monitor = Main.layoutManager.primaryMonitor;
         let maxHeight = Math.round(monitor.height - Main.panel.actor.height - this.actor.get_theme_node().get_length('-boxpointer-gap'));
         if(Main.panel2!=null) maxHeight -= Main.panel2.actor.height;
            this.actor.style = ('max-height: ' + maxHeight / scale + 'px;');
      }
   },

   showBoxPointer: function(show) {
      this._boxPointer.showArrow(show);
   },

   fixToCorner: function(fixCorner) {
      this._boxPointer.fixToCorner(fixCorner);
   },

   fixToScreen: function(fixCorner) {
      this._boxPointer.fixToScreen(this.launcher.actor, fixCorner);
   },

   setResizeArea: function(resizeSize) {
      this._boxPointer.setResizeArea(resizeSize);
   },

   setResizeAreaColor: function(resizeColor) {
      this._boxPointer.setResizeAreaColor(resizeColor);
   },

   repositionActor: function(actor) {
      if((this.launcher.actor)&&(this.launcher.actor != actor)) {
         this._boxPointer.trySetPosition(actor, this._arrowAlignment);
      }
   },

   getCurrentMenuThemeNode: function() {
      return this._boxPointer.getCurrentMenuThemeNode();
   },

   shiftPosition: function(x, y) {
      this._boxPointer.shiftPosition(x, y);
   },

   _openClean: function(animate) {
      if((this.isOpen)||(!this._reactive))
         return;

      this.isOpen = true;

      this._closeBrotherMenu();

      if(this._floating) {
         if(animate)
            this.animating = animate;
         else
            this.animating = false;
         this._boxPointer.show(animate, Lang.bind(this, function () {
            this.animating = false;
         }));
         if(!this._boxPointer._sourceActor)
            this._boxPointer.setPosition(this.launcher.actor, this._arrowAlignment);
         else
            this._boxPointer.setPosition(this._boxPointer._sourceActor, this._arrowAlignment);
         if(this._automaticOpenControl) {
            this._paintId = this.actor.connect("paint", Lang.bind(this, this._on_paint));
            Main.popup_rendering = true;
         } else {
            Main.popup_rendering = false;
         }
         if(global.menuStackLength == undefined)
            global.menuStackLength = 0;
         global.menuStackLength += 1;

         this.actor.raise_top();
      } else {
         this.actor.show();
      }

      this.setMaxHeight();

      let needsScrollbar = this._needsScrollbar();
      this._scroll.vscrollbar_policy =
            needsScrollbar ? Gtk.PolicyType.AUTOMATIC : Gtk.PolicyType.NEVER;

      // We don't need this right now and also we need to find
      // the monitor on Crome, so, request on idle.
      Mainloop.idle_add(Lang.bind(this, this._setChildsArrowSide));
      this.emit('open-state-changed', true);
   },

   _closeClean: function(animate) {
      if((!this.isOpen)||(!this._reactive))
         return;

      if(this._openedSubMenu) {
         this._openedSubMenu.close();
         this._openedSubMenu = null;
      }

      if(this._floating) {
         this._boxPointer.hide(animate);
         if(Main.panelManager) {
            for(let i in Main.panelManager.panels) {
               if(Main.panelManager.panels[i])
                  Main.panelManager.panels[i]._hidePanel();
            }
         }
         global.menuStackLength -= 1;
      } else {
         this.actor.hide();
      }

      if(this._activeMenuItem)
         this._activeMenuItem.setActive(false);

      this.isOpen = false;

      this.emit('open-state-changed', false);
   },

   toggle: function(animate) {
      if(this.isOpen)
         this.close(animate);
      else
         this.open(animate);
   },

   open: function(animate) {
      if(!this.isOpen) {
         this._openClean();
         this.repositionActor(this.sourceActor);
         if(animate) {
            this._applyEffectOnOpen();
         }
      }
   },

   close: function(animate) {
      if(this.isOpen) {
         if(this._openedSubMenu) {
            this._openedSubMenu.close(animate);
            this._openedSubMenu = null;
         }
         if(animate) {
            this._applyEffectOnClose();
         } else {
            this._closeClean();
         }
      }
   },

   _applyEffectOnOpen: function() {
      switch(this._effectType) {
         case "none"  :
            this._effectNoneOpen();
            break;
         case "dispel":
            this._effectDispelOpen();
            break;
         case "hideHorizontal"  :
            this._effectHideHorizontalOpen();
            break;
         case "hideVertical"  :
            this._effectHideVerticalOpen();
            break;
         case "scale" :
            this._effectScaleOpen();
            break;
         case "windows":
            this._effectWindowsOpen();
            break;
      }
   },

   _applyEffectOnClose: function() {
      switch(this._effectType) {
         case "none"  :
            this._effectNoneClose();
            break;
         case "dispel":
            this._effectDispelClose();
            break;
         case "hideHorizontal":
            this._effectHideHorizontalClose();
            break;
         case "hideVertical":
            this._effectHideVerticalClose();
            break;
         case "scale" :
            this._effectScaleClose();
            break;
         case "windows":
            this._effectWindowsClose();
            break;
      }
   },

   _effectNoneOpen: function() {
   },

   _effectNoneClose: function() {
      this._closeClean();
   },

   _effectDispelOpen: function() {
      this.actor.opacity = 0;
      Tweener.addTween(this.actor, {
         opacity: 255,
         time: this._effectTime,
         transition: 'easeInSine'
      });
   },

   _effectDispelClose: function() {
      Tweener.addTween(this.actor, {
         opacity: 0,
         time: this._effectTime,
         transition: 'easeInSine',
         onComplete: Lang.bind(this, function() {
            this._closeClean();
         })
      });
   },

   _effectWindowsOpen: function() {
      this.actor.rotation_angle_x = -100;
      Tweener.addTween(this.actor, {
         rotation_angle_x: 0,
         time: this._effectTime,
         transition: 'easeNone'
      });
   },

   _effectWindowsClose: function() {
      Tweener.addTween(this.actor, {
         rotation_angle_x: -100,
         time: this._effectTime,
         transition: 'easeNone',
         onComplete: Lang.bind(this, function() {
            this.actor.rotation_angle_x = 0;
            this._closeClean();
         })
      });
   },

  _effectHideHorizontalOpen: function() {
      let [startX, ay] = this.sourceActor.get_transformed_position();
      let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
      if(startX > monitor.x + monitor.width/2)
         startX += this.sourceActor.width;
      this.actor.x = startX;
      this.actor.scale_x = 0;
      Tweener.addTween(this.actor, {
         x: 0,
         scale_x: 1,
         transition: 'easeOutQuad',
         time: this._effectTime
      });
   },

   _effectHideHorizontalClose: function() {
      let [startX, ay] = this.sourceActor.get_transformed_position();
      let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
      if(startX > monitor.x + monitor.width/2)
         startX += this.sourceActor.width;
      Tweener.addTween(this.actor, {
         x: startX,
         scale_x: 0,
         time: this._effectTime,
         transition: 'easeOutQuad',
         onComplete: Lang.bind(this, function() {
            this._closeClean();
            this.actor.x = 0;
            this.actor.scale_x = 1;
         })
      });
   },

   _effectHideVerticalOpen: function() {
      let startY = this.sourceActor.height;
      if(this._arrowSide == St.Side.BOTTOM) {
         let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
         startY =  monitor.height - startY;
      }
      this.actor.y = startY;
      this.actor.scale_y = 0;
      Tweener.addTween(this.actor, {
         y: 0,
         scale_y: 1,
         transition: 'easeOutQuad',
         time: this._effectTime
      });
   },

   _effectHideVerticalClose: function() {
      let startY = this.sourceActor.height;
      if(this._arrowSide == St.Side.BOTTOM) {
         let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
         startY =  monitor.height - startY;
      }
      Tweener.addTween(this.actor, {
         y: startY,
         scale_y: 0,
         time: this._effectTime,
         transition: 'easeOutQuad',
         onComplete: Lang.bind(this, function() {
            this._closeClean();
            this.actor.y = 0;
            this.actor.scale_y = 1;
         })
      });
   },

   _effectScaleOpen: function() {
      let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
      let [startX, ay] = this.sourceActor.get_transformed_position();
      let startY = this.sourceActor.height;
      if(startX > monitor.x + monitor.width/2)
         startX += this.sourceActor.width;
      if(this._arrowSide == St.Side.BOTTOM)
         startY =  monitor.height - startY;
      this.actor.x = startX;
      this.actor.y = startY;
      this.actor.scale_x = 0;
      this.actor.scale_y = 0;
      Tweener.addTween(this.actor, {
         x: 0, y: 0,
         scale_x: 1, scale_y: 1,
         transition: 'easeOutQuad',
         time: this._effectTime
      });
   },

   _effectScaleClose: function() {
      let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
      let [startX, ay] = this.sourceActor.get_transformed_position();
      let startY = this.sourceActor.height;
      if(startX > monitor.x + monitor.width/2)
         startX += this.sourceActor.width;
      if(this._arrowSide == St.Side.BOTTOM)
         startY =  monitor.height - startY;
      Tweener.addTween(this.actor, {
         x: startX, y: startY,
         scale_x: 0, scale_y: 0,
         time: this._effectTime,
         transition: 'easeOutQuad',
         onComplete: Lang.bind(this, function() {
            this._closeClean();
            this.actor.x = 0;
            this.actor.y = 0;
            this.actor.scale_x = 1;
            this.actor.scale_y = 1;
         })
      });
   },

   _closeBrotherMenu: function() {
      let topMenu = this.getTopMenu();
      if(topMenu) {
         if((topMenu._openedSubMenu)&&(this != topMenu._openedSubMenu)&&
            (topMenu._openedSubMenu.isOpen)&&(this.isOpen)) {
            // We probably don't need to do this, as is also a tasks
            // of the MenuManager, but the MenuManager wont work ok.
            topMenu._openedSubMenu.close();
            topMenu._openedSubMenu = null;
         }
         if(this.isOpen)
            topMenu._openedSubMenu = this;
      }
   },

   _releaseActorState: function() {
      let parent = this._scroll.get_parent();
      if(parent != null)
         parent.remove_actor(this._scroll);
   },

   _needsScrollbar: function() {
      let topMenu = this.getTopMenu();
      if(!topMenu)
         return false;
      let [topMinHeight, topNaturalHeight] = topMenu.actor.get_preferred_height(-1);
      let topThemeNode = topMenu.actor.get_theme_node();

      let topMaxHeight = topThemeNode.get_max_height();
      return topMaxHeight >= 0 && topNaturalHeight >= topMaxHeight;
   },

   getTopMenu: function() {
      if(this._topMenu)
         return this._topMenu;
      else 
         return this._updateTopMenu();
   },

   _updateTopMenu: function() {
       this._topMenu = null;
       if(this.launcher) {
         let actor = this.launcher.actor;
         while(actor) {
            if((actor._delegate) && (actor._delegate instanceof PopupMenu.PopupMenu)) {
               this._topMenu = actor._delegate;
               break;
            }
            actor = actor.get_parent();
         }
      }
      if((this._topMenu)&&(this._topMenu.addChildMenu))
         this._topMenu.addChildMenu(this);
      return this._topMenu;
   },

   destroy: function() {
      if(this.actor) {
         if(this._vectorBlocker) {
            this._vectorBlocker.release();
            this._vectorBlocker = null;
         }
         this._releaseActorState();
         this.actor = this._scroll;
         //this._boxWrapper.add_actor(this._scroll);
         //this.actor = this._boxPointer.actor;
         this._boxPointer.actor.destroy();
         PopupMenu.PopupMenuBase.prototype.destroy.call(this);
         this.actor = null;
      }
   }
};

/**
 * CheckButton
 *
 * Just a class to show a Check button.
 */

function CheckButton() {
    this._init.apply(this, arguments);
}

CheckButton.prototype = {
    _init: function(state, params) {
        this._params = { style_class: 'check-box',
                         button_mask: St.ButtonMask.ONE,
                         toggle_mode: true,
                         can_focus: true,
                         x_fill: true,
                         y_fill: true,
                         y_align: St.Align.MIDDLE };

        if(params != undefined) {
            this._params = Params.parse(params, this._params);
        }

        this.actor = new St.Button(this._params);
        this.actor._delegate = this;
        this.actor.checked = state;
        // FIXME: The current size is big and the container only is useful,
        // because the current theme. Can be fixed the theme also?
        this._container = new St.Bin();
        this.actor.add_style_class_name('popup-menu-icon'); 
        this.actor.connect('notify::mapped', Lang.bind(this, this._onMapped));
        this.actor.set_child(this._container);
    },

    _onTheme: function() {
        this.actor.set_scale(1, 1);
    },

    _onMapped: function() {
        let size = this.actor.get_theme_node().get_length('icon-size');
        let scale = size/this.actor.width;
        this.actor.set_scale(scale, scale);
    },


    setToggleState: function(state) {
        this.actor.checked = state;
    },

    toggle: function() {
        this.setToggleState(!this.actor.checked);
    },

    destroy: function() {
        this.actor.destroy();
    }
};

/**
 * RadioBox
 *
 * Just a class to show a radio button.
 */
function RadioBox(state) {
    this._init(state);
}

RadioBox.prototype = {
    _init: function(state) {
        this.actor = new St.Button({ style_class: 'radiobutton',
                                     button_mask: St.ButtonMask.ONE,
                                     toggle_mode: true,
                                     can_focus: true,
                                     x_fill: true,
                                     y_fill: true,
                                     y_align: St.Align.MIDDLE });

        this.actor._delegate = this;
        this.actor.checked = state;
        this._container = new St.Bin();
        this.actor.add_style_class_name('popup-menu-icon'); 
        this.actor.connect('notify::mapped', Lang.bind(this, this._onMapped));
        this.actor.set_child(this._container);
    },

    _onMapped: function() {
        let size = this.actor.get_theme_node().get_length('icon-size');
        //Main.notify("size>" + size +" width>"+ this.actor.width)
        let scale = size/this.actor.width;
        this.actor.set_scale(scale, scale);;
    },

    setToggleState: function(state) {
        this.actor.checked = state;
    },

    toggle: function() {
        this.setToggleState(!this.actor.checked);
    },

    destroy: function() {
        this.actor.destroy();
    }
};

/**
 * Switch
 *
 * Just a class to show a switch.
 */
function Switch() {
   this._init.apply(this, arguments);
}

Switch.prototype = {
   _init: function(state) {
      this.actor = new St.Bin({ style_class: 'toggle-switch'});
      if(this.actor.set_accessible_role)
         this.actor.set_accessible_role(Atk.Role.CHECK_BOX);
      // Translators: this MUST be either "toggle-switch-us"
      // (for toggle switches containing the English words
      // "ON" and "OFF") or "toggle-switch-intl" (for toggle
      // switches containing "O" and "|"). Other values will
      // simply result in invisible toggle switches.
      this.actor.add_style_class_name("toggle-switch-intl");
      this.actor._delegate = this;
      this.setToggleState(state);
   },

   setToggleState: function(state) {
      if(state) this.actor.add_style_pseudo_class('checked');
      else this.actor.remove_style_pseudo_class('checked');
      this.state = state;
   },

   toggle: function() {
      this.setToggleState(!this.state);
   }
};

/**
 * ConfigurablePopupSubMenuMenuItem
 *
 * A class to extend the cinnamon standar PopupSubMenuMenuItem
 * but this class will controlled how the submenu will be displayed.
 * we want to have a foating submenu and automatically closing it
 * with a timer or when other brother submenu item was selected.
 */
function ConfigurablePopupSubMenuMenuItem() {
   this._init.apply(this, arguments);
}

ConfigurablePopupSubMenuMenuItem.prototype = {
   __proto__: PopupMenu.PopupSubMenuMenuItem.prototype,

   _init: function(text, hide_expander) {
      ConfigurablePopupMenuItem.prototype._init.call(this, text);
      this.actor._delegate = this;
      this.actor.add_style_class_name('popup-submenu-menu-item');
      this._arrowSide = St.Side.LEFT;
      this._hide_expander = hide_expander;

      this._triangle = new St.Icon({ icon_name: "media-playback-start",
                                     icon_type: St.IconType.SYMBOLIC,
                                     style_class: 'popup-menu-icon' });
      this._triangle.rotation_center_z_gravity = Clutter.Gravity.CENTER;
      if(this._hide_expander)
         this._triangle.hide();

      this.actor.add(this._triangle, { x_align: St.Align.END, y_align: St.Align.MIDDLE, x_fill:false });
      this._accel = "";
      this._vectorBlocker = null;

      this.menu = new ConfigurableMenu(this, 0.0, St.Side.LEFT, false);
      this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
      this.actor.connect('notify::mapped', Lang.bind(this, this._onMapped));
   },

   setAccel: function(accel) {
      //Main.notify("accel: " + accel);
      this._accel = accel;
   },

   haveIcon: function() {
      return ((this._icon.icon_name && this._icon.icon_name != "") || (this._icon.gicon));
   },

   setShowItemIcon: function(show) {
      this._displayIcon = show;
      this._icon.visible = (this._displayIcon)&&(this.haveIcon());
   },

   desaturateItemIcon: function(desaturate) {
      if(this._desaturateIcon != desaturate) {
         this._desaturateIcon = desaturate;
         if(desaturate)
            this._icon.add_effect_with_name("desaturate", new Clutter.DesaturateEffect());
         else
            this._icon.remove_effect_by_name("desaturate");
      }
   },

   setIconName: function(name) {
      this._icon.visible = ((this._displayIcon) && (name && name != ""));
      this._icon.icon_name = name;
   },

   setGIcon: function(gicon) {
      this._icon.visible = ((this._displayIcon) && (gicon != null));
      this._icon.gicon = gicon;
   },

   setArrowSide: function(side) {
      if(this._arrowSide != side) {
         if(this.menu._floating) {
            switch (side) {
               case St.Side.TOP:
               case St.Side.BOTTOM:
               case St.Side.LEFT:
                  if(this._triangle.rotation_angle_z != 0)
                     this._triangle.rotation_angle_z = 0;
                  if(this._arrowSide == St.Side.RIGHT) {
                     this.actor.remove_actor(this._triangle);
                     this.actor.add(this._triangle, { x_align: St.Align.END, y_align: St.Align.MIDDLE, x_fill:false });
                  }
                  break;
               case St.Side.RIGHT:
                  if(this._triangle.rotation_angle_z != 180)
                     this._triangle.rotation_angle_z = 180;
                  if(this._arrowSide != St.Side.RIGHT) {
                     this.actor.remove_actor(this._triangle);
                     //this.actor.insert_before(this._triangle, this.label);
                     this.actor.insert_before(this._triangle, this._icon);
                  }
                  break;
            }
            this._arrowSide = side;
         }
      }
   },

   setVectorBox: function(vectorBlocker) {
      if(this._vectorBlocker != vectorBlocker) {
         this._vectorBlocker = vectorBlocker;
      }
   },

   _onKeyPressEvent: function(actor, event) {
      let [openKey, closeKey] = this._getClutterOrientation();
      let symbol = event.get_key_symbol();
      if(symbol == openKey) {
         this.menu.open(true);
         this.menu.actor.navigate_focus(null, Gtk.DirectionType.DOWN, true);
         return true;
      } else if(symbol == closeKey && this.menu.isOpen) {
         this.menu.close();
         return true;
      }
      return PopupMenu.PopupBaseMenuItem.prototype._onKeyPressEvent.call(this, actor, event);
   },

   _getClutterOrientation: function() {
       if(this._arrowSide == St.Side.RIGHT)
           return [Clutter.KEY_Left, Clutter.KEY_Right];
       return [Clutter.KEY_Right, Clutter.KEY_Left];
   },

   _subMenuOpenStateChanged: function(menu, open) {
      if(open) {
         this.actor.add_style_pseudo_class('open');
         if((!this._hide_expander)&&(!this.menu._floating)) {
             let rotationAngle = 90;
             if(this.actor.get_direction() == St.TextDirection.RTL)
                rotationAngle = 270;
             this._triangle.rotation_angle_z = rotationAngle;
         }
      } else {
         this.actor.remove_style_pseudo_class('open');
         if(!this.menu._floating)
            this._triangle.rotation_angle_z = 0;
      }
   },

   _onHoverChanged: function (actor) {
      this.setActive(actor.hover);
      if((this._vectorBlocker)&&(actor.hover)) {
         this._vectorBlocker.executeInActors(this.actor, this.menu.actor);
      }
   },

   _onMapped: function() {
      this.menu._updateTopMenu();
   },

   _onButtonReleaseEvent: function (actor, event) {
      if(event.get_button() == 1) {
         if((!this.menu.isOpen)&&(this.menu._floating)) {
            this.menu.repositionActor(this.actor);
         }
         this.menu.toggle(true);
         return true;
      }
      return false;
   },

   destroy: function() {
      if(this.actor) {
         this.menu.destroy();
         PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
         this.actor = null;
      }
   }
};

/**
 * ConfigurablePopupMenuSection
 *
 * A class to extend the cinnamon standar PopupMenuSection
 * to support the creation of an space area on some special context.
 */
function ConfigurablePopupMenuSection() {
   this._init.apply(this, arguments);
}

ConfigurablePopupMenuSection.prototype = {
   __proto__: PopupMenu.PopupMenuSection.prototype,

   _init: function() {
      PopupMenu.PopupMenuSection.prototype._init.call(this);
      this.actor._delegate = this;
      this._showItemIcon = true;
      this._desaturateItemIcon = false;
      this._vectorBlocker = null;
   },

   addMenuItem: function(menuItem, position) {
      this._setShowItemIcon(menuItem);
      this._setDesaturateItemIcon(menuItem);
      this._setVectorBox(menuItem);
      if((menuItem instanceof PopupMenu.PopupSubMenuMenuItem)&&(this._isFloating(menuItem.menu))) {
         let beforeItem = null;
         if(position == undefined) {
            this.box.add(menuItem.actor);
         } else {
            let items = this._getMenuItems();
            if(position < items.length) {
               beforeItem = items[position].actor;
               this.box.insert_before(menuItem.actor, beforeItem);
            } else
               this.box.add(menuItem.actor);
         }
         this._connectSubMenuSignals(menuItem, menuItem.menu);
         this._connectItemSignals(menuItem);
      } else {
         PopupMenu.PopupMenuSection.prototype.addMenuItem.call(this, menuItem, position);
      }
   },

   setVectorBox: function(vectorBlocker) {
      if(this._vectorBlocker != vectorBlocker) {
         this._vectorBlocker = vectorBlocker;
         let items = this._getAllMenuItems();
         for(let pos in items) {
            this._setVectorBox(items[pos]);
         }
      }
   },

   setShowItemIcon: function(show) {
      if(this._showItemIcon != show) {
         this._showItemIcon = show;
         let items = this._getMenuItems();
         for(let pos in items) {
            let menuItem = items[pos];
            this._setShowItemIcon(menuItem);
         }
      }
   },

   desaturateItemIcon: function(desaturate) {
      if(this._desaturateItemIcon != desaturate) {
         this._desaturateItemIcon = desaturate;
         let items = this._getMenuItems();
         for(let pos in items) {
            let menuItem = items[pos];
            this._setDesaturateItemIcon(menuItem);
         }
      }
   },

   _setVectorBox: function(menuItem) {
      if(menuItem.setVectorBox)
         menuItem.setVectorBox(this._vectorBlocker);
   },

   _getAllMenuItems: function() {
      return this.box.get_children().map(function (actor) {
         return actor._delegate;
      });
   },

   _isFloating: function(menu) {
      return ((menu.isInFloatingState) && (menu.isInFloatingState()));
   },

   _setDesaturateItemIcon: function(menuItem) {
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         if(menuItem.menu.desaturateItemIcon)
             menuItem.menu.desaturateItemIcon(this._desaturateItemIcon);
      }
      if(menuItem.desaturateItemIcon)
          menuItem.desaturateItemIcon(this._desaturateItemIcon);
   },

   _setShowItemIcon: function(menuItem) {
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         if(menuItem.menu.setShowItemIcon)
             menuItem.menu.setShowItemIcon(this._showItemIcon);
      }
      if(menuItem.setShowItemIcon)
         menuItem.setShowItemIcon(this._showItemIcon);
   },

   destroy: function() {
      if(this.actor) {
         PopupMenu.PopupMenuSection.prototype.destroy.call(this);
         this.actor = null;
      }
   }
};

/**
 * ConfigurablePopupMenuItem
 *
 * A class to swap the cinnamon standar PopupMenuItem
 * to support a normal St actors.
 */
function ConfigurablePopupMenuItem() {
    this._init.apply(this, arguments);
}

ConfigurablePopupMenuItem.prototype = {
   __proto__: PopupMenu.PopupMenuItem.prototype,

   _init: function(text, params) {
      //PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
      params = Params.parse (params, { reactive: true,
                                       activate: true,
                                       hover: true,
                                       sensitive: true,
                                       style_class: null,
                                       focusOnHover: true,
                                     });
      this.actor = new St.BoxLayout({ style_class: 'popup-menu-item',
                                      reactive: params.reactive,
                                      track_hover: params.reactive,
                                      can_focus: params.reactive
                                   });
      if(this.actor.set_accessible_role)
         this.actor.set_accessible_role(Atk.Role.MENU_ITEM);
      this.actor.connect('style-changed', Lang.bind(this, this._onStyleChanged));
      this.actor._delegate = this;

      this._children = [];
      this._dot = null;
      this._columnWidths = null;
      this._spacing = 0;
      this.active = false;
      this._activatable = params.reactive && params.activate;
      this.sensitive = true;
      this.focusOnHover = params.focusOnHover;
      this._displayIcon = false;
      this._desaturateIcon = false;

      this.setSensitive(this._activatable && params.sensitive);

      if(params.style_class)
         this.actor.add_style_class_name(params.style_class);

      if(this._activatable) {
         this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
         this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
      }
      if(params.reactive && params.hover)
         this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));
      if(params.reactive) {
         this.actor.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
         this.actor.connect('key-focus-out', Lang.bind(this, this._onKeyFocusOut));
      }

      this.label = new St.Label({ text: text });
      this.actor.label_actor = this.label;
      this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
      this._icon.hide();
      this.actor.add(this._icon);
      this.actor.add(this.label, { y_align: St.Align.MIDDLE, y_fill:false, expand: true });
   },

   haveIcon: function() {
      return ((this._icon.icon_name && this._icon.icon_name != "") || (this._icon.gicon));
   },

   setShowItemIcon: function(show) {
      this._displayIcon = show;
      this._icon.visible = (this._displayIcon)&&(this.haveIcon());
   },

   setIconName: function(name) {
      this._icon.visible = ((this._displayIcon) && (name && name != ""));
      this._icon.icon_name = name;
   },

   desaturateItemIcon: function(desaturate) {
      if(this._desaturateIcon != desaturate) {
         this._desaturateIcon = desaturate;
         if(desaturate)
            this._icon.add_effect_with_name("desaturate", new Clutter.DesaturateEffect());
         else
            this._icon.remove_effect_by_name("desaturate");
      }
   },

   setGIcon: function(gicon) {
      this._icon.visible = ((this._displayIcon) && (gicon != null));
      this._icon.gicon = gicon;
   },

   destroy: function() {
      if(this.actor) {
         PopupMenu.PopupMenuItem.prototype.destroy.call(this);
         this.actor = null;
      }
   }
};

/**
 * ConfigurableApplicationMenuItem
 *
 * A class to extend the cinnamon standar PopupMenuItem
 * to support ornaments and automatically close the submenus.
 */
function ConfigurableApplicationMenuItem() {
   this._init.apply(this, arguments);
}

ConfigurableApplicationMenuItem.prototype = {
   __proto__: ConfigurablePopupMenuItem.prototype,

   _init: function(text) {
      ConfigurablePopupMenuItem.prototype._init.call(this, text);
      this.actor._delegate = this;

      this._accel = new St.Label();
      this._ornament = new St.Bin();
      this.actor.add(this._accel,    { x_align: St.Align.END, y_align: St.Align.MIDDLE, x_fill:false });
      this.actor.add(this._ornament, { x_align: St.Align.END, y_align: St.Align.MIDDLE, x_fill:false });
   },

   setAccel: function(accel) {
      this._accel.set_text(accel);
   },

   setOrnament: function(ornamentType, state) {
      switch (ornamentType) {
      case OrnamentType.CHECK:
         if((this._ornament.child)&&(!(this._ornament.child._delegate instanceof CheckButton))) {
             this._ornament.child.destroy();
             this._ornament.child = null;
         }
         if(!this._ornament.child) {
             let checkOrn = new CheckButton(state);
             this._ornament.child = checkOrn.actor;
         } else {
             this._ornament.child._delegate.setToggleState(state);
         }
         break;
      case OrnamentType.DOT:
         if((this._ornament.child)&&(!(this._ornament.child._delegate instanceof RadioBox))) {
             this._ornament.child.destroy();
             this._ornament.child = null;
         }
         if(!this._ornament.child) {
             let radioOrn = new RadioBox(state);
             this._ornament.child = radioOrn.actor;
         } else {
             this._ornament.child._delegate.setToggleState(state);
         }
         break;
      }
   },

   destroy: function() {
      if(this.actor) {
         ConfigurablePopupMenuItem.prototype.destroy.call(this);
         this.actor = null;
      }
   }
};

/**
 * ConfigurableMenuApplet
 *
 * A class to hacked the cinnamon standar PopupSubMenuMenuItem
 * to be displayed over the cinnamon panel.
 */
function ConfigurableMenuApplet() {
    this._init.apply(this, arguments);
}

ConfigurableMenuApplet.prototype = {
    __proto__: ConfigurableMenu.prototype,

   _init: function(launcher, orientation, menuManager) {
      ConfigurableMenu.prototype._init.call(this, launcher, 0.0, orientation, false);
      this._menuManager = menuManager;
      this._showAccel = false;
      this._isSubMenuOpen = false;
      this._openOnHover = false;

      this._appletBox = new St.BoxLayout({ vertical: false, reactive: true });
      this._appletBox._delegate = this;
      this.launcher.actor.add(this._appletBox);
      this.launcher.actor.set_track_hover(this._floating);

      if(this._floating) {
      } else {
         if(!this._scroll.get_parent())
            this._appletBox.add(this._scroll);
         this.actor = this._appletBox;
         this.actor.add(this.box);
         this.actor.hide();
      }
      this._menuManager.addMenu(this);

      this._appletBox.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
      if(this.launcher._applet_tooltip) {
         this._appletBox.connect('enter-event', Lang.bind(this, this._onEnterEvent));
         this._appletBox.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
      }
   },

   _onEnterEvent: function() {
      this.launcher._applet_tooltip.preventShow = true;
   },

   _onLeaveEvent: function() {
      this.launcher._applet_tooltip.preventShow = false;
   },

   toogleSubmenu: function(animate) {
      if(this._isSubMenuOpen)
         this.closeSubmenu(animate);
      else
         this.openSubmenu(animate);
   },

   openSubmenu: function(animate) {
      if(!this._isSubMenuOpen) {
         if(this._floating) {
            this.open(animate);
         } else {
            if(!this.isOpen)
               this.open(animate);
            let items = this._getMenuItems();
            let menuItem = null;
            for(let pos in items) {
               menuItem = items[pos];
               if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
                  menuItem.menu.open(animate);
                  break;
               }
            }
            this._activeSubMenuItem = menuItem;
         }
         this.actor.grab_key_focus();
         this._isSubMenuOpen = true;
      }
   },

   closeSubmenu: function(animate) {
      if(this._isSubMenuOpen) {
         if(this._floating) {
            this.close(animate);
         } else {
            let items = this._getMenuItems();
            for(let pos in items) {
               let menuItem = items[pos];
               if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
                  menuItem.menu.close(animate);
               }
            }
         }
         this._activeSubMenuItem = null;
         this._isSubMenuOpen = false;
      }
   },

   open: function(animate) {
      if(this._floating) {
         if(this._childMenus.length > 0)
            ConfigurableMenu.prototype.open.call(this, false);
      } else if(!this.isOpen) {
         this.actor.show();
         this._setChildsArrowSide();
         this.isOpen = true;
         this.emit('open-state-changed', true);
      }
   },

   close: function(animate, forced) {
      if(this._floating) {
         ConfigurableMenu.prototype.close.call(this, false);
      } else if((forced)&&(this.isOpen)) {
         this.actor.hide();
         this._activeSubMenuItem = null;
         this._isSubMenuOpen = false;
         this.isOpen = false;
         this.emit('open-state-changed', false);
      }
   },

   forcedToggle: function() {
      if(this.isOpen)
          this.close(false, true);
      else
          this.open(false);
   },

   setArrowSide: function(side) {
      ConfigurableMenu.prototype.setArrowSide.call(this, side);
      if(!this._floating) {
         for(let pos in this._childMenus) {
            this._childMenus[pos].setArrowSide(side);
         }
      }
   },

   setOpenOnHover: function(openOnHover) {
      this._openOnHover = openOnHover;
   },

   getOpenOnHover: function() {
      return this._openOnHover;
   },

   setFloatingState: function(floating) {
      ConfigurableMenu.prototype.setFloatingState.call(this, floating);
      this._releaseItemBox();
      if(this.launcher)
         this.launcher.actor.set_track_hover(this._floating);
      if(this._floating) {
         this.box.set_style_class_name('popup-menu-content');
         this.box.set_vertical(true);
         this._scroll.add_actor(this.box);
         this._scroll.show();
      } else {
         this.box.set_style_class_name('applet-container-box');
         this.box.set_vertical(false);
         if(this._appletBox) {
            if(!this._scroll.get_parent())
               this._appletBox.add(this._scroll);
            this.actor = this._appletBox;
            this.actor.add(this.box);
            this.actor.hide();
         }
      }
      let items = this._getMenuItems();
      for(let pos in items) {
         let menuItem = items[pos];
         if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
            this._setMenuInPosition(menuItem);
            this._setShowItemIcon(menuItem);
            menuItem.menu.fixToCorner(menuItem.menu.fixCorner);
         }
      }
   },

   addMenuItem: function(menuItem, position) {
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         let beforeItem = null;
         if(position == undefined) {
            this.box.add(menuItem.actor);
         } else {
            let items = this._getMenuItems();
            if(position < items.length) {
               beforeItem = items[position].actor;
               this.box.insert_before(menuItem.actor, beforeItem);
            } else
               this.box.add(menuItem.actor);
         }
         this._connectSubMenuSignals(menuItem, menuItem.menu);
         this._connectItemSignals(menuItem);
         menuItem._closingId = this.connect('open-state-changed', function(self, open) {
            if(!open)
               menuItem.menu.close(false);
         });
         menuItem._closeId = menuItem.menu.connect('open-state-changed', Lang.bind(this, function(self, open) {
            if((!open) && (this._isSubMenuOpen)) {
               this._isSubMenuOpen = false;
            }
         }));
         this._setMenuInPosition(menuItem);
         this._setShowItemIcon(menuItem);
         this._setDesaturateItemIcon(menuItem);
         this.addChildMenu(menuItem.menu);
         menuItem.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
         menuItem.actor.connect('notify::hover', Lang.bind(this, this._onMenuItemHoverChanged));
         //this.setAccel(menuItem);
      } else {
         ConfigurableMenu.prototype.addMenuItem.call(this, menuItem, position);
      }
   },

   _onMenuItemHoverChanged: function(actor) {
      if((actor.hover)&&(!this._floating)&&(this._openOnHover)) {
         actor._delegate.menu.open(true);
      }
   },
/*
   setAccel: function(menuItem) {
      if(menuItem.setAccel) {
         let accelkeys = this.getMainAccelkeys();
         let text = menuItem.label.get_text();
         for(let pos in text) {
            if(accelkeys.indexOf(text[pos]) != -1) {
               menuItem.setAccel(text[pos]);
               break;
            }
         }
         if(menuItem._accel == "") {
            menuItem.setAccel(text[0]);
         }
      }
   },

   getMainAccelkeys: function() {
      let items = this._getMenuItems();
      let accelkeys = [];
      for(let pos in items) {
         let menuItem = items[pos];
         if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
            accelkeys.push(menuItem._accel);
         }
      }
      return accelkeys;
   },

   showAccel: function(show) {
      if(show != this._showAccel) {
         this._showAccel = show;
         let items = this._getMenuItems();
         let menuItem, text, accel, posAccel;
         for(let pos in items) {
            menuItem = items[pos];
            if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
               text = menuItem.label.get_text();
               accel = menuItem._accel;
               if(show) {
                  posAccel = text.indexOf(accel);
                  text = text.substring(0, posAccel-1) + "<u>" + text[posAccel] + "</u>" + text.substring(posAccel+1, text.length);
                  menuItem.label.clutter_text.set_markup(text);
               } else {
                  text = text.replace("<u>", "").replace("</u>", "");
                  menuItem.label.clutter_text.set_markup(text);
               }
            }
         }
      }
   },
*/

   _onKeyPressEvent: function(actor, event) {
      if(this._floating) {
         let result = ConfigurableMenu.prototype._onKeyPressEvent.call(this, actor, event);
         if(result)
            this.closeSubmenu();
         return result;
      } else if(this.isOpen) {
         let close = false;
         let direction = this._getGtkDirectionType(event.get_key_symbol());
         if(direction) {
            if(!this._activeSubMenuItem) {
               this._activeSubMenuItem = this._getFirstMenuItem(this);
            }
            if((direction == Gtk.DirectionType.LEFT)||(direction == Gtk.DirectionType.RIGHT)) {
               this.actor.navigate_focus(this._activeSubMenuItem.actor, direction, true);
               this._activeSubMenuItem = global.stage.key_focus._delegate;
               if(this._activeSubMenuItem && this._activeSubMenuItem.menu)
                   this._activeSubMenuItem.menu.open(true);
               this.actor.grab_key_focus();
               return true;
            } else if(direction == this._getGtkScapeDirectionType()) {
               close = true;
            } else if(this._activeSubMenuItem && this._activeSubMenuItem.menu) {
               this._activeSubMenuItem.menu.actor.grab_key_focus();
            }
         } 
         if((close)||(event.get_key_symbol() == Clutter.Escape)) {
            this.close(true);
            if((this.launcher)&&(this.launcher.setActive))
               this.launcher.setActive(true);
            this.closeSubmenu();
            return true;
         }
      }
      return false;
   },

   _getGtkScapeDirectionType: function() {
      let scapeKey = null;
      if(this._arrowSide == St.Side.LEFT)
         scapeKey = Gtk.DirectionType.LEFT;
      else if(this._arrowSide == St.Side.RIGHT)
         scapeKey = Gtk.DirectionType.RIGHT;
      else if(this._arrowSide == St.Side.TOP)
         scapeKey = Gtk.DirectionType.UP;
      else if(this._arrowSide == St.Side.BOTTOM)
         scapeKey = Gtk.DirectionType.DOWN;
      return scapeKey;
   },

   _getGtkDirectionType: function(clutterKey) {
      let scapeKey = null;
      if(clutterKey == Clutter.KEY_Left)
         scapeKey = Gtk.DirectionType.LEFT;
      else if(clutterKey == Clutter.KEY_Right)
         scapeKey = Gtk.DirectionType.RIGHT;
      else if(clutterKey == Clutter.KEY_Up)
         scapeKey = Gtk.DirectionType.UP;
      else if(clutterKey == Clutter.KEY_Down)
         scapeKey = Gtk.DirectionType.DOWN;
      return scapeKey;
   },

   _setChildsArrowSide: function() {
      if(this._floating) {
         ConfigurableMenu.prototype._setChildsArrowSide.call(this);
      } else {
         for(let pos in this._childMenus) {
            let menu = this._childMenus[pos];
            menu.setArrowSide(this._arrowSide);
         }
      }
   },

   _releaseItemBox: function() {
      let parent = this.box.get_parent();
      if(parent != null)
          parent.remove_actor(this.box);
   },

   _setDesaturateItemIcon: function(menuItem) {
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         if(menuItem.menu.desaturateItemIcon)
             menuItem.menu.desaturateItemIcon(this._desaturateItemIcon);
      }
      if(menuItem.desaturateItemIcon)
          menuItem.desaturateItemIcon(this._desaturateItemIcon);
   },

   _setShowItemIcon: function(menuItem) {
      if(menuItem instanceof PopupMenu.PopupSubMenuMenuItem) {
         if(menuItem.menu.setShowItemIcon)
             menuItem.menu.setShowItemIcon(this._showItemIcon);
         if(menuItem.setShowItemIcon)
             menuItem.setShowItemIcon((this._showItemIcon)&&(this._floating));
      } else if(menuItem.setShowItemIcon)
         menuItem.setShowItemIcon(this._showItemIcon);
   },

   _setMenuInPosition: function(menuItem) {
      if(this._floating) {
         menuItem.menu.setArrowSide(St.Side.LEFT);
         menuItem._triangle.show();
         menuItem.label.set_style_class_name('');
         menuItem.actor.set_style_class_name('popup-menu-item');
         menuItem.actor.add_style_class_name('popup-submenu-menu-item');
      } else {
         menuItem.menu.setArrowSide(this._arrowSide);
         menuItem._triangle.hide();
         menuItem._icon.hide();
         menuItem.label.set_style_class_name('applet-label');
         menuItem.actor.add_style_class_name('applet-box');
      }
   },

   _onButtonPressEvent: function (actor, event) {
      if((!this.floating)&&(event.get_button() == 1)&&(this.launcher._draggable.inhibit)) {
         return true;
      }
      return false;
   },

   destroy: function() {
      if(this.actor) {
         this._releaseItemBox();
         this._scroll.add_actor(this.box);
         let parent = this._scroll.get_parent();
         if(parent != null)
            parent.remove_actor(this._scroll);
         this.actor = this._scroll;
         ConfigurableMenu.prototype.destroy.call(this);
         this._appletBox.destroy();
         this.actor = null;
      }
   }
};

/**
 * PopupMenuAbstractFactory
 *
 * An abstract class to binding the cinnamon standar PopupMenu implementation
 * with an abstract representation of a menu.
 */
function PopupMenuAbstractFactory() {
   throw new TypeError('Trying to instantiate abstract class PopupMenuAbstractFactory');
}

PopupMenuAbstractFactory.prototype = {

   _init: function(id, childrenIds, params) {
      this._id = id;
      this._childrenIds = childrenIds;
      if(!this._childrenIds)
         this._childrenIds = new Array();

      this._internalSignalsHandlers = new Array();
      this._externalSignalsHandlers = new Array();
      this._shellItemSignalsHandlers = null;
      this._shellMenuSignalsHandlers = null;

      this.shellItem = null;
      this.parent = null;

      // Properties
      params = Params.parse (params, { label: "",
                                       accel: "",
                                       sensitive: true,
                                       visible: true,
                                       toggleType: "",
                                       toggleState: false,
                                       iconName: "",
                                       iconData: null,
                                       action:"",
                                       paramType: "", //this is a variant
                                       type: FactoryClassTypes.MenuItemClass
                                     });
      this._label = params.label;
      this._accel = params.accel;
      this._sensitive = params.sensitive;
      this._visible = params.visible;
      this._toggleType = params.toggleType;
      this._toggleState = params.toggleState;
      this._iconName = params.iconName;
      this._iconData = params.iconData;
      this._type = params.type;
      this._action = params.action;
      this._paramType = params.paramType;
   },

   getItemById: function(id) {throw new Error('Trying to use abstract function getItemById');},
   handleEvent: function(event, params) {throw new Error('Trying to use abstract function handleEvent');},
   //isRoot: function() {throw new Error('Trying to use abstract function isRoot');},

   isVisible: function() {
      return this._visible;
   },

   setVisible: function(visible) {
      if(this._visible != visible) {
         this._visible = visible;
         this._updateVisible();
      }
   },

   isSensitive: function() {
      return this._sensitive;
   },

   setSensitive: function(sensitive) {
      if(this._sensitive != sensitive) {
         this._sensitive = sensitive;
         this._updateSensitive();
      }
   },

   getLabel: function() {
      return this._label; 
   },

   setLabel: function(label) {
      if(this._label != label) {
         this._label = label;
         this._updateLabel();
      }
   },

   getAction: function() {
      return this._action;
   },

   setAction: function(action) {
      if(this._action != action) {
         this._action = action;
      }
   },

   getParamType: function() {
      return this._paramType;
   },

   setParamType: function(paramType) {
      if(this._paramType != paramType) {
         this._paramType = paramType;
      }
   },

   getFactoryType: function() {
      return this._type;
   },

   setFactoryType: function(type) {
      if((type) && (this._type != type)) {
         this._type = type;
         this._updateType();
      }
   },

   getIconName: function() {
      return this._iconName;
   },

   setIconName: function(iconName) {
      if(this._iconName != iconName) {
         this._iconName = iconName;
         this._updateImage();
      }
   },

   getGdkIcon: function() {
      return this._iconData;
   },

   setGdkIcon: function(iconData) {
      if(this._iconData != iconData) {
         this._iconData = iconData;
         this._updateImage();
      }
   },

   getToggleType: function() {
      return this._toggleType;
   },

   setToggleType: function(toggleType) {
      if(this._toggleType != toggleType) {
         this._toggleType = toggleType;
         this._updateOrnament();
      }
   },

   getToggleState: function() {
      return this._toggleState;
   },

   setToggleState: function(toggleState) {
      if(this._toggleState != toggleState) {
         this._toggleState = toggleState;
         this._updateOrnament();
      }
   },

   getAccel: function() {
      return this._accel;
   },

   setAccel: function(accel) {
      if(this._accel != accel) {
         this._accel = accel;
         this._updateAccel();
      }
   },

   setShellItem: function(shellItem, handlers) {
      if(this.shellItem != shellItem) {
         if(this.shellItem) {
            //this.shellItem.destroy();
            global.logWarning("Attempt to override a shellItem, so we automatically destroy our original shellItem.");
         }
         this.shellItem = shellItem;

         if(this.shellItem) {
            // Initialize our state
            this._updateLabel();
            this._updateOrnament();
            this._updateAccel();
            this._updateImage();
            this._updateVisible();
            this._updateSensitive();

            this._connectAndSaveId(this, handlers, this._internalSignalsHandlers);

            this._shellItemSignalsHandlers = this._connectAndSaveId(this.shellItem, {
               'activate':  Lang.bind(this, this._onActivate),
               'destroy' :  Lang.bind(this, this._onShellItemDestroyed)
            });
            if(this.shellItem.menu) {
               this._shellMenuSignalsHandlers = this._connectAndSaveId(this.shellItem.menu, {
                  'open-state-changed': Lang.bind(this, this._onOpenStateChanged),
                  'destroy'           : Lang.bind(this, this._onShellMenuDestroyed)
               });
            } else {
               this._connectAndSaveId(this.shellItem, {
                  'open-state-changed': Lang.bind(this, this._onOpenStateChanged),
               }, this._shellItemSignalsHandlers);
            }
         }
      }
   },

   _updateLabel: function() {
      if((this.shellItem)&&(this.shellItem.label)) {
         let label = this.getLabel();
         // Especially on GS3.8, the separator item might not even have a hidden label
         if(this.shellItem.label) 
            this.shellItem.label.set_text(label);
      }
   },

   _updateOrnament: function() {
      // Separators and alike might not have gotten the polyfill
      if((this.shellItem)&&(this.shellItem.setOrnament)) { 
         if(this.getToggleType() == "checkmark") {
            this.shellItem.setOrnament(OrnamentType.CHECK, this.getToggleState());
         } else if(this.getToggleType() == "radio") {
            this.shellItem.setOrnament(OrnamentType.DOT, this.getToggleState());
         } else {
            this.shellItem.setOrnament(OrnamentType.NONE);
         }
      }
   },

   _updateAccel: function() {
      if((this.shellItem)&&(this.shellItem.setAccel)) {
         let accel = this.getAccel();
         if(accel) {
            this.shellItem.setAccel(accel);
         }
      }
   },

   _updateImage: function() {
      // Might be missing on submenus / separators
      if((this.shellItem)&&(this.shellItem._icon)) {
         let iconName = this.getIconName();
         if(iconName) {
            if(this.shellItem.setIconName)
               this.shellItem.setIconName(iconName);
            else if(this.shellItem._icon) {
               this.shellItem._icon.icon_name = iconName;
                this.shellItem._icon.show();
            }
         } else {
            let gicon = this.getGdkIcon();
            if(gicon) {
               if(this.shellItem.setGIcon)
                  this.shellItem.setGIcon(gicon);
               else if(this.shellItem._icon) {
                  this.shellItem._icon.gicon = gicon;
                  this.shellItem._icon.show();
               }
            }
         }
      }
   },

   _updateVisible: function() {
      if(this.shellItem) {
         this.shellItem.actor.visible = this.isVisible();
      }
   },

   _updateSensitive: function() {
      if((this.shellItem)&&(this.shellItem.setSensitive)) {
         this.shellItem.setSensitive(this.isSensitive());
      }
   },

   _updateType: function() {
      this.emit('type-changed');
   },

   getShellItem: function() {
      return this.shellItem;
   },

   getId: function() {
      return this._id;
   },

   getChildrenIds: function() {
      // Clone it!
      return this._childrenIds.concat();
   },

   getChildren: function() {
      return this._childrenIds.map(function(childId) {
         return this.getItemById(childId);
      }, this);
   },

   getParent: function() {
      return this.parent;
   },

   setParent: function(parent) {
      this.parent = parent;
   },

   addChild: function(pos, childId) {
      let factoryItem = this.getItemById(childId);
      if(factoryItem) {
         // If our item is previusly asigned, so destroy first the shell item.
         factoryItem.destroyShellItem();
         factoryItem.setParent(this);
         this._childrenIds.splice(pos, 0, childId);
         this.emit('child-added', factoryItem, pos);
      }
   },

   removeChild: function(childId) {
      // Find it
      let pos = -1;
      for(let i = 0; i < this._childrenIds.length; ++i) {
         if(this._childrenIds[i] == childId) {
            pos = i;
            break;
         }
      }

      if(pos < 0) {
         global.logError("Trying to remove child which doesn't exist");
      } else {
         this._childrenIds.splice(pos, 1);
         let factoryItem = this.getItemById(childId);
         if(factoryItem) {
            let shellItem = factoryItem.getShellItem();
            this._destroyShellItem(shellItem);
            factoryItem.setParent(null);
            this.emit('child-removed', factoryItem);
         }
      }
      if(this._childrenIds.length == 0) {
         this.emit('childs-empty');
      }
   },

   moveChild: function(childId, newpos) {
      // Find the old position
      let oldpos = -1;
      for(let i = 0; i < this._childrenIds.length; ++i) {
         if(this._childrenIds[i] == childId) {
            oldpos = i;
            break;
         }
      }

      if(oldpos < 0) {
         global.logError("tried to move child which wasn't in the list");
         return;
      }

      if(oldpos != newpos) {
         this._childrenIds.splice(oldpos, 1);
         this._childrenIds.splice(newpos, 0, childId);
         this.emit('child-moved', this.getItemById(childId), oldpos, newpos);
      }
   },

   // handlers = { "signal": handler }
   connectAndRemoveOnDestroy: function(handlers) { 
      this._connectAndSaveId(this, handlers, this._externalSignalsHandlers);
   },

   destroyShellItem: function() {
      this._destroyShellItem(this.shellItem);
   },

   // We try to not crash cinnamon if a shellItem will be destroyed,
   // but while he (or she) has the focus and also the asociate menu would be
   // open. A Cinnamon crash is not allowed now. Tested with firefox...
   _destroyShellItem: function(shellItem) {
      if(shellItem) {
         let focus = global.stage.key_focus;
         if(shellItem.close)
            shellItem.close();
         if(shellItem.menu)
            shellItem.menu.close();
         if(focus && shellItem.actor && shellItem.actor.contains(focus)) {
            if(shellItem.sourceActor)
               shellItem.sourceActor.grab_key_focus();
            else if((shellItem.menu)&&(shellItem.menu.sourceActor))
               shellItem.menu.sourceActor.grab_key_focus();
            else
               global.stage.set_key_focus(null);
         }
         shellItem.destroy();
      }
   },

   // handlers = { "signal": handler }
   _connectAndSaveId: function(target, handlers , idArray) {
      idArray = typeof idArray != 'undefined' ? idArray : [];
      for(let signal in handlers) {
         idArray.push(target.connect(signal, handlers[signal]));
      }
      return idArray;
   },

   _disconnectSignals: function(obj, signalsHandlers) {
      if((obj)&&(signalsHandlers)) {
         for(let pos in signalsHandlers)
            obj.disconnect(signalsHandlers[pos]);
      }
   },

   _onActivate: function(shellItem, event, keepMenu) {
      this.handleEvent("clicked");
   },

   _onOpenStateChanged: function(menu, open) {
      //this._onShellMenuPreOpened(menu);
      if(open) {
         this.handleEvent("opened");
      } else {
         this.handleEvent("closed");
      }
   },

   //HACK: When a submenu will close, also close all childs submenus. 
/* _onShellMenuPreOpened: function(menu) {
      let topMenu = this._getTopMenu(menu);
      if(topMenu) {
         if((topMenu._openedSubMenu)&&(menu != topMenu._openedSubMenu)&&
             (topMenu._openedSubMenu.isOpen)&&(menu.isOpen)) {
            topMenu._openedSubMenu.close(true);
         }
         if(menu.isOpen)
            topMenu._openedSubMenu = menu;
      }
      if(!menu.isOpen)
         this._closeAllSubmenuChilds(menu);
   },

   _closeAllSubmenuChilds: function(menu) {
      let childs = this._getMenuItems(menu);
      let child;
      for(let i in childs) {
         child = childs[i];
         if(child instanceof PopupMenu.PopupMenuBase) {
            this._closeAllSubmenuChilds(child);
         }
         else if((child.menu)&&(child.menu.isOpen)) {
            this._closeAllSubmenuChilds(child.menu);
            child.menu.close();
         }
      }
   },

   _getTopMenu: function(shellItem) {
      let actor = shellItem.actor.get_parent();
      while (actor) {
         if((actor._delegate) && ((actor._delegate instanceof PopupMenu.PopupMenu) ||
             (actor._delegate instanceof PopupMenu.PopupSubMenu)))
            return actor._delegate;
         actor = actor.get_parent();
      }
      return null;
   },

   _getMenuItems: function(menu) {
      return menu.box.get_children().map(Lang.bind(this, function (actor) {
         return actor._delegate;
      }));
   },*/

   _onShellItemDestroyed: function(shellItem) {
      if((this.shellItem)&&(this.shellItem == shellItem)) {
         this.shellItem = null;
         if(this._internalSignalsHandlers) {
            this._disconnectSignals(this, this._internalSignalsHandlers);
            this._internalSignalsHandlers = [];
         }
         if(this._shellItemSignalsHandlers) {
            this._disconnectSignals(shellItem, this._shellItemSignalsHandlers);
            this._shellItemSignalsHandlers = null;
         }
      } else if(this.shellItem) {
         global.logError("We are not conected with " + shellItem);
      } else {
         global.logWarning("We are not conected with any shellItem");
      }
   },

   _onShellMenuDestroyed: function(shellMenu) {
      if(this._shellMenuSignalsHandlers) {
         this._disconnectSignals(shellMenu, this._shellMenuSignalsHandlers);
         this._shellMenuSignalsHandlers = null;
      }
   },

   destroy: function() {
      if(this._externalSignalsHandlers) {
         // Emit the destroy first, to allow know to external lisener,
         // then, disconnect the lisener handler.
         this.emit("destroy");
         this.destroyShellItem();
         this.shellItem = null;
         this._disconnectSignals(this, this._externalSignalsHandlers);
         this._externalSignalsHandlers = null;
         this._internalSignalsHandlers = null;
      }
   }
};
Signals.addSignalMethods(PopupMenuAbstractFactory.prototype);

/**
 * A MenuFactory to displayed an abstract menu items inside the real cinnamon menu items.
 *
 * Processes events, creates the actors and handles the action on a bidirectional way.
 */
function MenuFactory() {
   this._init.apply(this, arguments);
}

MenuFactory.prototype = {

   _init: function() {
      this._menuLikend = new Array();
      this._menuManager = new Array();
   },

   _createShellItem: function(factoryItem, launcher, orientation, menuManager) {
      // Decide whether it's a submenu or not
      let shellItem = null;
      let item_type = factoryItem.getFactoryType();
      if(item_type == FactoryClassTypes.RootMenuClass)
         shellItem = new Applet.PopupMenu(launcher, orientation);
      if(item_type == FactoryClassTypes.SubMenuMenuItemClass)
         shellItem = new PopupMenu.PopupSubMenuMenuItem("FIXME");
      else if(item_type == FactoryClassTypes.MenuSectionMenuItemClass)
         shellItem = new PopupMenu.PopupMenuSection();
      else if(item_type == FactoryClassTypes.SeparatorMenuItemClass)
         shellItem = new PopupMenu.PopupSeparatorMenuItem('');
      else if(item_type == FactoryClassTypes.MenuItemClass)
         shellItem = new PopupMenu.PopupMenuItem("FIXME");
      //else
      //    throw new TypeError('Trying to instantiate a shell item with an invalid factory type');
      return shellItem;
   },

   getShellMenu: function(factoryMenu) {
      let index = this._menuLikend.indexOf(factoryMenu);
      if(index != -1) {
         return factoryMenu.getShellItem();
      }
      return null;
   },

   getMenuManager: function(factoryMenu) {
      let index = this._menuLikend.indexOf(factoryMenu);
      if(index != -1) {
         return this._menuManager[index];
      }
      return null;
   },

   buildShellMenu: function(factoryMenu, launcher, orientation, menuManager) {
      let shellItem = this.getShellMenu(factoryMenu);
      if(factoryMenu.shellItem)
         return factoryMenu.shellItem;

      if(!(factoryMenu instanceof PopupMenuAbstractFactory)) {
         throw new Error("MenuFactory: can't construct an instance of \
              PopupMenu using a non instance of the class PopupMenuAbstractFactory");
      }
      // The shell menu
      let shellItem = this._createShellItem(factoryMenu, launcher, orientation, menuManager);
      this._attachToMenu(shellItem, factoryMenu);
      this._menuManager.push(menuManager);
      return shellItem;
   },

   // This will attach the root factoryItem to an already existing menu that will be used as the root menu.
   // it will also connect the factoryItem to be automatically destroyed when the menu dies.
   _attachToMenu: function(shellItem, factoryItem) {
      // Cleanup: remove existing childs (just in case)
      shellItem.removeAll();

      // Fill the menu for the first time
      factoryItem.getChildren().forEach(function(child) {
         shellItem.addMenuItem(this._createItem(child));
      }, this);

      factoryItem.setShellItem(shellItem, {
         //'type-changed':   Lang.bind(this, this._onTypeChanged),
         'child-added'   : Lang.bind(this, this._onChildAdded),
         'child-moved'   : Lang.bind(this, this._onChildMoved)
      });
      this._menuLikend.push(factoryItem);
      factoryItem.connectAndRemoveOnDestroy({
         'destroy'           : Lang.bind(this, this._onDestroyMainMenu)
      });
   },

   _onDestroyMainMenu: function(factoryItem) {
      let index = this._menuLikend.indexOf(factoryItem);
      if(index != -1) {
         this._menuLikend.splice(index, 1);
      }
   },

   _setOrnamentPolyfill: function(ornamentType, state) {
      if(ornamentType == OrnamentType.CHECK) {
         if(state) {
            this._ornament.set_text('\u2714');
            if(this.actor.add_accessible_state)
               this.actor.add_accessible_state(Atk.StateType.CHECKED);
         } else {
            this._ornament.set_text('\u2752');
            if(this.actor.remove_accessible_state)
               this.actor.remove_accessible_state(Atk.StateType.CHECKED);
         }
      } else if(ornamentType == OrnamentType.DOT) {
         if(state) {
            this._ornament.set_text('\u2022');
            if(this.actor.add_accessible_state)
               this.actor.add_accessible_state(Atk.StateType.CHECKED);
         } else {
            this._ornament.set_text('\u274D');
            if(this.actor.remove_accessible_state)
               this.actor.remove_accessible_state(Atk.StateType.CHECKED);
         }
      } else {
         this._ornament.set_text('');
         if(this.actor.remove_accessible_state)
            this.actor.remove_accessible_state(Atk.StateType.CHECKED);
      }
   },

   // GS3.8 uses a complicated system to compute the allocation for each child in pure JS
   // we hack together a function that allocates space for our ornament, using the x
   // calculations normally used for the dot and the y calculations used for every
   // other item. Thank god they replaced that whole allocation stuff in 3.10, so I don't
   // really need to understand how it works, as long as it looks right in 3.8
   _allocateOrnament: function(actor, box, flags, shellItem) {
      if(!shellItem._ornament) return;

      let height = box.y2 - box.y1;
      let direction = actor.get_text_direction();

      let dotBox = new Clutter.ActorBox();
      let dotWidth = Math.round(box.x1 / 2);

      if(direction == Clutter.TextDirection.LTR) {
         dotBox.x1 = Math.round(box.x1 / 4);
         dotBox.x2 = dotBox.x1 + dotWidth;
      } else {
         dotBox.x2 = box.x2 + 3 * Math.round(box.x1 / 4);
         dotBox.x1 = dotBox.x2 - dotWidth;
      }

      let [minHeight, naturalHeight] = shellItem._ornament.get_preferred_height(dotBox.x2 - dotBox.x1);

      dotBox.y1 = Math.round(box.y1 + (height - naturalHeight) / 2);
      dotBox.y2 = dotBox.y1 + naturalHeight;

      shellItem._ornament.allocate(dotBox, flags);
   },

   _createItem: function(factoryItem) {
      // Don't allow to override previusly preasigned items, destroy the shell item first.
      factoryItem.destroyShellItem();
      let shellItem = this._createShellItem(factoryItem);
      this._hackShellItem(shellItem);

      // Initially create children on idle, to not stop cinnamon mainloop.
      Mainloop.idle_add(Lang.bind(this, this._createChildrens, factoryItem));

      // Now, connect various events
      factoryItem.setShellItem(shellItem, {
         'type-changed':       Lang.bind(this, this._onTypeChanged),
         'child-added':        Lang.bind(this, this._onChildAdded),
         'child-moved':        Lang.bind(this, this._onChildMoved)
      });
      return shellItem;
   },

   _createChildrens: function(factoryItem) {
      if(factoryItem) {
         let shellItem = factoryItem.getShellItem();
         if(shellItem instanceof PopupMenu.PopupSubMenuMenuItem) {
            let children = factoryItem.getChildren();
            for(let i = 0; i < children.length; ++i) {
               let chItem = this._createItem(children[i]);
               shellItem.menu.addMenuItem(chItem);
            }
         } else if(shellItem instanceof PopupMenu.PopupMenuSection) {
            let children = factoryItem.getChildren();
            for(let i = 0; i < children.length; ++i) {
               let chItem = this._createItem(children[i]);
               shellItem.addMenuItem(chItem);
            }
         }
      }
   },

   _onChildAdded: function(factoryItem, child, position) {
      let shellItem = factoryItem.getShellItem();
      if(shellItem) {
         if(shellItem instanceof PopupMenu.PopupSubMenuMenuItem) {
            shellItem.menu.addMenuItem(this._createItem(child), position, "factor");
         } else if((shellItem instanceof PopupMenu.PopupMenuSection) ||
                    (shellItem instanceof PopupMenu.PopupMenu)) {
            shellItem.addMenuItem(this._createItem(child), position);
         } else {
            global.logWarning("Tried to add a child to non-submenu item. Better recreate it as whole");
            this._onTypeChanged(factoryItem);
         }
      } else {
         global.logWarning("Tried to add a child shell item to non existing shell item.");
      }
   },

   _onChildMoved: function(factoryItem, child, oldpos, newpos) {
      let shellItem = factoryItem.getShellItem();
      if(shellItem) {
         if(shellItem instanceof PopupMenu.PopupSubMenuMenuItem) {
            this._moveItemInMenu(shellItem.menu, child, newpos);
         } else if((shellItem instanceof PopupMenu.PopupMenuSection) ||
                    (shellItem instanceof PopupMenu.PopupMenu)) {
            this._moveItemInMenu(shellItem, child, newpos);
         } else {
            global.logWarning("Tried to move a child in non-submenu item. Better recreate it as whole");
            this._onTypeChanged(factoryItem);
         }
      } else {
         global.logWarning("Tried to move a child shell item in non existing shell item.");
      }
   },

   // If this function is apply, this mean that our old shellItem
   // is not valid right now, so we can destroy it with all the deprecate
   // submenu structure and then create again for the new factoryItem source.
   _onTypeChanged: function(factoryItem) {
      let shellItem = factoryItem.getShellItem();
      let factoryItemParent = factoryItem.getParent();
      let parentMenu = null;
      if(factoryItemParent) {
         let shellItemParent = factoryItemParent.getShellItem();
         if(shellItemParent instanceof PopupMenu.PopupMenuSection)
            parentMenu = shellItemParent;
         else
            parentMenu = shellItemParent.menu;
      }
      // First, we need to find our old position
      let pos = -1;
      if((parentMenu)&&(shellItem)) {
         let family = parentMenu._getMenuItems();
         for(let i = 0; i < family.length; ++i) {
            if(family[i] == shellItem)
               pos = i;
         }
      }
      // if not insert the item in first position.
      if(pos < 0)
         pos = 0;
      // Now destroy our old self
      factoryItem.destroyShellItem();
      if(parentMenu) {
         // Add our new self
         let newShellItem = this._createItem(factoryItem);
         parentMenu.addMenuItem(newShellItem, pos);
      }
   },

   _moveItemInMenu: function(menu, factoryItem, newpos) {
      // HACK: we're really getting into the internals of the PopupMenu implementation
      // First, find our wrapper. Children tend to lie. We do not trust the old positioning.
      let shellItem = factoryItem.getShellItem();
      if(shellItem) {
         let family = menu._getMenuItems();
         for(let i = 0; i < family.length; ++i) {
            if(family[i] == shellItem) {
               // Now, remove it
               menu.box.remove_child(shellItem.actor);

               // Add it again somewhere else
               if(newpos < family.length && family[newpos] != shellItem)
                  menu.box.insert_child_below(shellItem.actor, family[newpos].actor);
               else
                  menu.box.add(shellItem.actor);

               // Skip the rest
               break;
            }
         }
      }
   },

   _hackShellItem: function(shellItem) {
      if(shellItem instanceof PopupMenu.PopupMenuItem) {
         if(!shellItem.setAccel) {
            shellItem._accel = new St.Label();
            if(shellItem.addActor) { //GS 3.8
               shellItem.addActor(shellItem._accel);
            } else { //GS >= 3.10
               shellItem.actor.add_actor(shellItem._accel);
            }
         }

         if(!shellItem._icon) {
            shellItem._icon = new St.Icon({ style_class: 'popup-menu-icon', x_align: St.Align.END });
            if(shellItem.addActor) { //GS 3.8
               shellItem.addActor(shellItem._icon, { align: St.Align.END });
            } else { //GS >= 3.10
               shellItem.actor.add(shellItem._icon, { x_align: St.Align.END });
               shellItem.label.get_parent().child_set(shellItem.label, { expand: true });
            }
         }

         // GS3.8: emulate the ornament stuff.
         // this is similar to how the setShowDot function works
         if(!shellItem.setOrnament) {

            shellItem._ornament = new St.Label();
            shellItem.actor.add_actor(shellItem._ornament);
            shellItem.setOrnament = this._setOrnamentPolyfill;
            //GS doesn't disconnect that one, either
            shellItem.actor.connect('allocate', Lang.bind(this, this._allocateOrnament, shellItem));
         }
      }
   }
};

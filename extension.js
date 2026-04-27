import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GDesktopEnums from 'gi://GDesktopEnums';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        console.log("[Deperto] Enabling extension - Direct Magnifier Mode");

        this._settings = this.getSettings();
        
        // 1. Configure Window Manager (Force Super as modifier to free up Alt)
        this._wmSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
        this._originalWmModifier = this._wmSettings.get_string('mouse-button-modifier');
        this._wmSettings.set_string('mouse-button-modifier', '<Super>');

        // 2. Cache settings for performance
        this._updateSettings();
        this._settingsChangedId = this._settings.connect('changed', this._updateSettings.bind(this));

        // 3. Internal State
        this._currentZoom = 1.0;
        this._zoomMonitorIndex = -1;

        // 4. Track monitor layout changes to drop a stale zoom region
        this._monitorsChangedId = Main.layoutManager.connect(
            'monitors-changed', this._onMonitorsChanged.bind(this));

        // 5. Capture Events
        this._stageSignalId = global.stage.connect('captured-event', this._onCapturedEvent.bind(this));
    }

    _updateSettings() {
        this._modifierKey = this._settings.get_string('modifier-key');
        this._zoomStep = this._settings.get_double('zoom-step');
        this._smoothZoom = this._settings.get_boolean('smooth-zoom');
    }

    disable() {
        console.log("[Deperto] Disabling extension...");

        // 1. Disconnect Events
        if (this._stageSignalId) {
            global.stage.disconnect(this._stageSignalId);
            this._stageSignalId = null;
        }

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }

        // 2. Disconnect Settings
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }

        // 3. Restore original window manager settings
        if (this._wmSettings) {
            if (this._originalWmModifier) {
                this._wmSettings.set_string('mouse-button-modifier', this._originalWmModifier);
            }
            this._wmSettings = null;
        }

        // 4. Reset zoom and deactivate magnifier if we activated it
        if (this._currentZoom > 1.0) {
            this._applyZoom(1.0);
        }
        
        this._settings = null;
    }

    _onCapturedEvent(actor, event) {
        // Only interested in SCROLL events
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        const state = event.get_state();
        const selectedModifier = this._modifierKey;
        
        const hasSuper = (state & Clutter.ModifierType.MOD4_MASK) !== 0;
        const hasAlt = (state & Clutter.ModifierType.MOD1_MASK) !== 0;
        const hasCtrl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;

        let match = false;

        // Check for specific combinations: Super+Alt or Super+Ctrl
        if (selectedModifier === 'ctrl-super') {
            match = hasCtrl && hasSuper;
        } else {
            // Default: super-alt
            match = hasSuper && hasAlt;
        }

        // If not the exact combination, let the system handle it
        if (!match) {
            return Clutter.EVENT_PROPAGATE;
        }

        // Zoom Logic
        const direction = event.get_scroll_direction();
        let zoomChange = 0;
        const ZOOM_STEP = this._zoomStep || 0.25;

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            zoomChange = -dy * ZOOM_STEP; 
        } else {
            if (direction === Clutter.ScrollDirection.UP) {
                zoomChange = ZOOM_STEP;
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                zoomChange = -ZOOM_STEP;
            }
        }

        if (Math.abs(zoomChange) < 0.001) return Clutter.EVENT_STOP;

        let newZoom = this._currentZoom + zoomChange;

        // Safety limits (1.0x to 20.0x)
        if (newZoom < 1.0) newZoom = 1.0;
        if (newZoom > 20.0) newZoom = 20.0;

        if (newZoom !== this._currentZoom) {
            this._applyZoom(newZoom);
        }

        return Clutter.EVENT_STOP;
    }

    _applyZoom(zoomFactor) {
        if (!Main.magnifier) {
            console.error("[Deperto] Main.magnifier not found");
            return;
        }

        const wasZoomed = this._currentZoom > 1.0;
        const willZoom = zoomFactor > 1.0;

        if (willZoom && !wasZoomed) {
            // Replace the default region (full virtual desktop) with one bound
            // to the monitor under the cursor.
            const target = this._resolveTargetGeometry();
            Main.magnifier.clearAllZoomRegions();
            const region = Main.magnifier.createZoomRegion(
                zoomFactor, zoomFactor, target.geometry, target.geometry);
            Main.magnifier.addZoomRegion(region);
            region.setMouseTrackingMode(
                GDesktopEnums.MagnifierMouseTrackingMode.PROPORTIONAL);
            Main.magnifier.setActive(true);
            this._zoomMonitorIndex = target.monitorIndex;
        } else if (willZoom && wasZoomed) {
            // animate: true is smoother but can lag during rapid scrolling (Issue azacio)
            // animate: false is much faster and more responsive (Issue account1009)
            // setMagFactor uses the public API but forces animate=true, so the
            // non-animated path falls back to _changeROI to preserve responsiveness.
            Main.magnifier.getZoomRegions().forEach(region => {
                if (this._smoothZoom) {
                    region.setMagFactor(zoomFactor, zoomFactor);
                } else {
                    region._changeROI({
                        xMagFactor: zoomFactor,
                        yMagFactor: zoomFactor,
                        redoCursorTracking: true,
                        animate: false,
                    });
                }
            });
        } else if (!willZoom && wasZoomed) {
            Main.magnifier.setActive(false);
            Main.magnifier.clearAllZoomRegions();
            this._zoomMonitorIndex = -1;
        }

        this._currentZoom = zoomFactor;
    }

    _resolveTargetGeometry() {
        const [px, py] = global.get_pointer();
        const monitor = Main.layoutManager.findMonitorForPoint(px, py)
            ?? Main.layoutManager.primaryMonitor;
        return {
            monitorIndex: monitor.index,
            geometry: {
                x: monitor.x,
                y: monitor.y,
                width: monitor.width,
                height: monitor.height,
            },
        };
    }

    _onMonitorsChanged() {
        if (this._currentZoom <= 1.0) return;
        Main.magnifier.setActive(false);
        Main.magnifier.clearAllZoomRegions();
        this._currentZoom = 1.0;
        this._zoomMonitorIndex = -1;
    }
}

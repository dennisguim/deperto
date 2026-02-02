import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        console.log("Deperto: Activating V6 (Super+Scroll only)...");
        this._signals = [];
        this._lastSmoothScrollTime = 0; // To fix double zoom
        
        // 1. Magnifier Settings
        this._a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.applications' });
        
        // Save original state to restore later
        this._originalMagnifierEnabled = this._a11ySettings.get_boolean('screen-magnifier-enabled');
        this._a11ySettings.set_boolean('screen-magnifier-enabled', true);

        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        
        // Save original tracking mode
        this._originalMouseTracking = this._settings.get_enum('mouse-tracking');
        this._settings.set_enum('mouse-tracking', 2); // 2 = proportional

        const handler = this._handleEvent.bind(this);

        // 2. Connect to Stage (Global)
        this._signals.push({
            object: global.stage,
            id: global.stage.connect('captured-event', handler)
        });

        // 3. Connect to Window Group (Windows)
        if (global.window_group) {
            this._signals.push({
                object: global.window_group,
                id: global.window_group.connect('captured-event', handler)
            });
        }
    }

    disable() {
        this._signals.forEach(signal => {
            signal.object.disconnect(signal.id);
        });
        this._signals = [];
        
        // Restore original settings
        if (this._a11ySettings) {
            this._a11ySettings.set_boolean('screen-magnifier-enabled', this._originalMagnifierEnabled);
            this._a11ySettings = null;
        }

        if (this._settings) {
            this._settings.set_enum('mouse-tracking', this._originalMouseTracking);
            this._settings = null;
        }
    }

    _handleEvent(actor, event) {
        // Check Modifiers (SUPER only)
        const state = event.get_state();
        const isSuperPressed = (state & Clutter.ModifierType.MOD4_MASK) !== 0; // Windows/Command key

        if (!isSuperPressed) {
            return Clutter.EVENT_PROPAGATE;
        }

        const type = event.type();

        // Filter only SCROLL (8)
        if (type !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        // --- ZOOM LOGIC ---
        const direction = event.get_scroll_direction();
        let zoomChange = 0;
        const ZOOM_STEP = 0.25;
        const now = Date.now();

        // Scroll Detection
        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            // Invert dy to be natural (Scroll Down = Zoom Out)
            zoomChange = -dy * ZOOM_STEP; 
            this._lastSmoothScrollTime = now;
        } else {
            // If UP/DOWN (Discrete)
            // CHECK: If we had a SMOOTH event very recently (e.g. < 50ms), ignore this discrete event
            // This fixes the "double jump" problem on modern mice.
            if (now - this._lastSmoothScrollTime < 50) {
                 return Clutter.EVENT_STOP; 
            }

            if (direction === Clutter.ScrollDirection.UP) {
                zoomChange = ZOOM_STEP;
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                zoomChange = -ZOOM_STEP;
            }
        }

        // Minimum threshold
        if (Math.abs(zoomChange) < 0.005) return Clutter.EVENT_STOP;
        
        let currentZoom = this._settings.get_double('mag-factor');
        let newZoom = Math.max(1.0, Math.min(20.0, currentZoom + zoomChange));

        if (newZoom !== currentZoom) {
            this._settings.set_double('mag-factor', newZoom);
        }

        return Clutter.EVENT_STOP;
    }
}
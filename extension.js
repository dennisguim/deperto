import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        console.log("Deperto (Zoom): Enabling extension...");
        this._eventHandlerId = null;
        
        // 1. Ensure Magnifier is enabled
        this._a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.applications' });
        this._a11ySettings.set_boolean('screen-magnifier-enabled', true);

        // 2. Configure Magnifier to follow mouse (Essential for XFCE effect)
        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        this._settings.set_enum('mouse-tracking', 2); // 2 = proportional

        // 3. Connect to the Global Stage (The Root of all input)
        // We use a lambda to ensure 'this' context and correct argument handling
        this._eventHandlerId = global.stage.connect('captured-event', (actor, event) => {
            return this._handleEvent(actor, event);
        });

        console.log("Deperto (Zoom): Connected to global.stage (Universal Capture).");
    }

    disable() {
        if (this._eventHandlerId) {
            global.stage.disconnect(this._eventHandlerId);
            this._eventHandlerId = null;
        }
        this._settings = null;
        this._a11ySettings = null;
        console.log("Deperto (Zoom): Disabled.");
    }

    _handleEvent(actor, event) {
        // 1. Filter: Only care about SCROLL events
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        // 2. Filter: Check for ALT key (Mod1)
        const state = event.get_state();
        const isAltPressed = (state & Clutter.ModifierType.MOD1_MASK) !== 0;

        if (!isAltPressed) {
            return Clutter.EVENT_PROPAGATE;
        }

        // Debug Log: If we get here, we successfully intercepted an Alt+Scroll
        // This helps us prove if Wayland is blocking us or if it's just a logic bug.
        console.log(`Deperto: Alt+Scroll detected over actor: ${actor}`);

        // 3. Calculate Zoom
        const direction = event.get_scroll_direction();
        let zoomChange = 0;
        const ZOOM_STEP = 0.25;

        if (direction === Clutter.ScrollDirection.UP) {
            zoomChange = ZOOM_STEP;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            zoomChange = -ZOOM_STEP;
        } else if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            // Invert dy because scrolling down (positive) usually means "next page", 
            // but for zoom we want "pull back" (zoom out).
            zoomChange = -dy * ZOOM_STEP; 
        }

        // Ignore tiny movements (touchpad noise)
        if (Math.abs(zoomChange) < 0.005) {
             return Clutter.EVENT_PROPAGATE;
        }
        
        // 4. Apply Zoom
        let currentZoom = this._settings.get_double('mag-factor');
        let newZoom = Math.max(1.0, Math.min(10.0, currentZoom + zoomChange));

        if (newZoom !== currentZoom) {
            this._settings.set_double('mag-factor', newZoom);
            // CRITICAL: Stop the event so the window doesn't scroll too
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }
}
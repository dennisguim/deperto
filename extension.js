import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        console.log("[Deperto] Enabling extension");

        // 0. Load the extension's own settings
        this._settings = this.getSettings();

        // 1. Configure Window Manager (Force Super)
        this._wmSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
        this._originalWmModifier = this._wmSettings.get_string('mouse-button-modifier');
        
        // Explicitly set to Super, allowing Alt to be free for our combination
        this._wmSettings.set_string('mouse-button-modifier', '<Super>');

        // 2. Configure Magnifier (Zoom)
        this._a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.applications' });
        this._originalMagnifierEnabled = this._a11ySettings.get_boolean('screen-magnifier-enabled');
        // Ensure the magnifier feature is enabled in the system
        this._a11ySettings.set_boolean('screen-magnifier-enabled', true);

        this._magSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        this._originalMouseTracking = this._magSettings.get_enum('mouse-tracking');
        // Force 'proportional' mode so the zoom follows the mouse
        this._magSettings.set_enum('mouse-tracking', 2); 

        // 3. Capture Events
        this._stageSignalId = global.stage.connect('captured-event', this._onCapturedEvent.bind(this));
    }

    disable() {
        console.log("[Deperto] Disabling extension...");

        // 1. Disconnect Events
        if (this._stageSignalId) {
            global.stage.disconnect(this._stageSignalId);
            this._stageSignalId = null;
        }

        // 2. Restore original settings
        if (this._wmSettings) {
            // Restore the previous window action key (or keep Super if it fails)
            if (this._originalWmModifier) {
                this._wmSettings.set_string('mouse-button-modifier', this._originalWmModifier);
            }
            this._wmSettings = null;
        }

        if (this._magSettings) {
            this._magSettings.set_enum('mouse-tracking', this._originalMouseTracking);
            this._magSettings = null;
        }

        if (this._a11ySettings) {
            this._a11ySettings.set_boolean('screen-magnifier-enabled', this._originalMagnifierEnabled);
            this._a11ySettings = null;
        }
        
        this._settings = null;
    }

    _onCapturedEvent(actor, event) {
        // Only interested in SCROLL events
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        const state = event.get_state();
        const selectedModifier = this._settings.get_string('modifier-key');
        
        const hasSuper = (state & Clutter.ModifierType.MOD4_MASK) !== 0;
        const hasAlt = (state & Clutter.ModifierType.MOD1_MASK) !== 0;
        const hasCtrl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;

        let match = false;

        // Check which combination the user chose
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
        const ZOOM_STEP = 0.25; // Zoom sensitivity

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            // negative dy is scroll up (zoom in)
            zoomChange = -dy * ZOOM_STEP; 
        } else {
            if (direction === Clutter.ScrollDirection.UP) {
                zoomChange = ZOOM_STEP;
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                zoomChange = -ZOOM_STEP;
            }
        }

        // Avoid unnecessary processing for tiny movements
        if (Math.abs(zoomChange) < 0.001) return Clutter.EVENT_STOP;

        // Apply the new zoom
        let currentZoom = this._magSettings.get_double('mag-factor');
        let newZoom = currentZoom + zoomChange;

        // Safety limits (1.0x to 20.0x)
        if (newZoom < 1.0) newZoom = 1.0;
        if (newZoom > 20.0) newZoom = 20.0;

        if (newZoom !== currentZoom) {
            this._magSettings.set_double('mag-factor', newZoom);
        }

        return Clutter.EVENT_STOP; // Prevent the scroll from affecting the window/app below
    }
}

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        console.log("Deperto: Activating (Customizable Modifier)...");
        this._signals = [];
        this._lastSmoothScrollTime = 0; // To fix double zoom
        this._lastWorkspaceSwitchTime = 0; // Debounce for workspace switching
        
        // 1. Extension Settings (Preferences)
        this._extensionSettings = this.getSettings();
        
        // 2. Window Manager Settings (To fix conflict)
        this._wmSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
        this._originalWmModifier = this._wmSettings.get_string('mouse-button-modifier');

        this._updateModifierMask();
        this._settingsSignalId = this._extensionSettings.connect('changed::modifier-key', () => {
            this._updateModifierMask();
        });

        // 3. Magnifier Settings
        this._a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.applications' });
        
        // Save original state to restore later
        this._originalMagnifierEnabled = this._a11ySettings.get_boolean('screen-magnifier-enabled');
        this._a11ySettings.set_boolean('screen-magnifier-enabled', true);

        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        
        // Save original tracking mode
        this._originalMouseTracking = this._settings.get_enum('mouse-tracking');
        this._settings.set_enum('mouse-tracking', 2); // 2 = proportional

        const handler = this._handleEvent.bind(this);

        // 4. Connect to Stage (Global)
        this._signals.push({
            object: global.stage,
            id: global.stage.connect('captured-event', handler)
        });

        // 5. Connect to Window Group (Windows)
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
        
        // Disconnect settings signal
        if (this._extensionSettings && this._settingsSignalId) {
            this._extensionSettings.disconnect(this._settingsSignalId);
            this._extensionSettings = null;
        }

        // Restore original settings
        if (this._a11ySettings) {
            this._a11ySettings.set_boolean('screen-magnifier-enabled', this._originalMagnifierEnabled);
            this._a11ySettings = null;
        }

        if (this._settings) {
            this._settings.set_enum('mouse-tracking', this._originalMouseTracking);
            this._settings = null;
        }

        // Restore WM settings
        if (this._wmSettings) {
            this._wmSettings.set_string('mouse-button-modifier', this._originalWmModifier);
            this._wmSettings = null;
        }
    }

    _updateModifierMask() {
        const key = this._extensionSettings.get_string('modifier-key');
        switch (key) {
            case 'alt':
                this._requiredModifiers = Clutter.ModifierType.MOD1_MASK;
                break;
            case 'super-alt':
                this._requiredModifiers = Clutter.ModifierType.MOD4_MASK | Clutter.ModifierType.MOD1_MASK;
                break;
            case 'shift-super':
                this._requiredModifiers = Clutter.ModifierType.SHIFT_MASK | Clutter.ModifierType.MOD4_MASK;
                break;
            case 'shift-alt':
                this._requiredModifiers = Clutter.ModifierType.SHIFT_MASK | Clutter.ModifierType.MOD1_MASK;
                break;
            case 'ctrl-super':
                this._requiredModifiers = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD4_MASK;
                break;
            case 'ctrl-alt':
                this._requiredModifiers = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
                break;
            case 'super':
            default:
                this._requiredModifiers = Clutter.ModifierType.MOD4_MASK;
                break;
        }
        console.log(`[Deperto] New modifier mask set for '${key}': ${this._requiredModifiers}`);

        // Sync Window Manager Action Key
        // Per user requirement: To make zoom work over windows, the WM action key
        // must MATCH the zoom modifier (or at least one of them).
        // If Super is involved -> Set WM to Super.
        // If Alt is involved (and no Super) -> Set WM to Alt.
        
        const currentWm = this._wmSettings.get_string('mouse-button-modifier');
        
        if (key.includes('super')) {
            if (currentWm !== '<Super>') {
                console.log("[Deperto] Adjusting WM key to <Super> to match extension shortcut.");
                this._wmSettings.set_string('mouse-button-modifier', '<Super>');
            }
        } else {
            // Defaults to Alt logic (for 'alt', 'ctrl-alt', 'shift-alt')
            if (currentWm !== '<Alt>') {
                console.log("[Deperto] Adjusting WM key to <Alt> to match extension shortcut.");
                this._wmSettings.set_string('mouse-button-modifier', '<Alt>');
            }
        }
    }

    _switchWorkspace(event) {
        const now = Date.now();
        // Debounce: 250ms to prevent rapid switching
        if (now - this._lastWorkspaceSwitchTime < 250) {
            return;
        }

        const direction = event.get_scroll_direction();
        const wsManager = global.workspace_manager;
        const activeIndex = wsManager.get_active_workspace_index();
        const nWorkspaces = wsManager.get_n_workspaces();
        let newIndex = activeIndex;

        if (direction === Clutter.ScrollDirection.UP) {
            newIndex--;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            newIndex++;
        } else if (direction === Clutter.ScrollDirection.SMOOTH) {
             const [dx, dy] = event.get_scroll_delta();
             // Threshold to ignore tiny accidental scrolls
             if (Math.abs(dy) < 5.0) return; 
             
             if (dy < 0) newIndex--; // Scroll Up -> Prev
             else if (dy > 0) newIndex++; // Scroll Down -> Next
        }
        
        // Clamp to valid range
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= nWorkspaces) newIndex = nWorkspaces - 1;

        if (newIndex !== activeIndex) {
            wsManager.get_workspace_by_index(newIndex).activate(global.get_current_time());
            this._lastWorkspaceSwitchTime = now;
        }
    }

    _handleEvent(actor, event) {
        const type = event.type();

        // Handle ESC (Reset Zoom) - Works without modifier if zoomed in
        if (type === Clutter.EventType.KEY_PRESS && event.get_key_symbol() === Clutter.KEY_Escape) {
            const currentZoom = this._settings.get_double('mag-factor');
            if (currentZoom > 1.0) {
                this._settings.set_double('mag-factor', 1.0);
                return Clutter.EVENT_STOP;
            }
        }

        // Check Modifiers for Scrolling
        const state = event.get_state();

        // WORKSPACE SWITCHING LOGIC (Conflict Resolution)
        // If extension uses 'super' for Zoom, we hijack 'Alt+Scroll' to switch workspaces
        // because 'Super+Scroll' is now taken by Zoom.
        if (this._extensionSettings.get_string('modifier-key') === 'super' && type === Clutter.EventType.SCROLL) {
            const isAltPressed = (state & Clutter.ModifierType.MOD1_MASK) === Clutter.ModifierType.MOD1_MASK;
            // Ideally ensure Super is NOT pressed to distinctively identify this fallback interaction
            const isSuperPressed = (state & Clutter.ModifierType.MOD4_MASK) === Clutter.ModifierType.MOD4_MASK;

            if (isAltPressed && !isSuperPressed) {
                 this._switchWorkspace(event);
                 return Clutter.EVENT_STOP;
            }
        }
        
        // We check if ALL required bits are present in the state
        // (state & required) === required
        const isModifierPressed = (state & this._requiredModifiers) === this._requiredModifiers;

        // DEBUG: Uncomment if needed
        // if (type === Clutter.EventType.SCROLL) {
        //    console.log(`[Deperto] Scroll. State: ${state}, Required: ${this._requiredModifiers}, Match: ${isModifierPressed}`);
        // }

        if (!isModifierPressed) {
            return Clutter.EVENT_PROPAGATE;
        }

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

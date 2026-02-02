import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        this._signals = [];
        this._lastScrollTime = 0;
        
        // Garante que a lupa esteja ativada no sistema
        this._a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.applications' });
        this._a11ySettings.set_boolean('screen-magnifier-enabled', true);

        // Configura o comportamento da lupa para seguir o mouse (Essencial para o efeito XFCE)
        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        this._settings.set_enum('mouse-tracking', 2); // 2 = proportional

        // Handler vinculado ao 'this'
        const handler = this._handleEvent.bind(this);

        // 1. Conecta ao Stage Global (Geralmente pega tudo)
        this._signals.push({
            object: global.stage,
            id: global.stage.connect('captured-event', handler)
        });

        // 2. Conecta ao Window Group (Reforço para janelas de apps)
        // Em alguns casos, o stage pode não disparar para janelas em certas sessões Wayland,
        // mas o grupo de janelas pode capturar.
        if (global.window_group) {
            this._signals.push({
                object: global.window_group,
                id: global.window_group.connect('captured-event', handler)
            });
        }

        console.log("Deperto (Zoom by Scroll): Ativado com listeners múltiplos.");
    }

    disable() {
        // Desconecta todos os sinais
        this._signals.forEach(signal => {
            signal.object.disconnect(signal.id);
        });
        this._signals = [];

        this._settings = null;
        this._a11ySettings = null;
        console.log("Deperto (Zoom by Scroll): Desativado.");
    }

    _handleEvent(actor, event) {
        // 1. Filtra apenas eventos de Scroll
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        // 2. Previne processamento duplicado (debounce simples)
        // Se o evento vier do stage E do window_group muito rápido
        const now = Date.now();
        if (now - this._lastScrollTime < 10) {
            return Clutter.EVENT_STOP; // Já tratado
        }

        // 3. Verifica se a tecla ALT está pressionada
        const state = event.get_state();
        const isAltPressed = (state & Clutter.ModifierType.MOD1_MASK) !== 0;

        if (!isAltPressed) {
            return Clutter.EVENT_PROPAGATE;
        }

        this._lastScrollTime = now;

        // 4. Identifica a direção e intensidade do scroll
        const direction = event.get_scroll_direction();
        let zoomChange = 0;
        const ZOOM_STEP = 0.25;

        if (direction === Clutter.ScrollDirection.UP) {
            zoomChange = ZOOM_STEP;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            zoomChange = -ZOOM_STEP;
        } else if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            zoomChange = -dy * ZOOM_STEP; 
        } else {
            return Clutter.EVENT_PROPAGATE;
        }

        if (Math.abs(zoomChange) < 0.005) {
             return Clutter.EVENT_PROPAGATE;
        }
        
        // 5. Calcula e aplica o novo fator de Zoom
        let currentZoom = this._settings.get_double('mag-factor');
        let newZoom = Math.max(1.0, Math.min(10.0, currentZoom + zoomChange));

        if (newZoom !== currentZoom) {
            this._settings.set_double('mag-factor', newZoom);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }
}

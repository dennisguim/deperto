import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        this._eventHandlerId = null;
        
        // Garante que a lupa esteja ativada no sistema (Acessibilidade)
        this._a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.applications' });
        this._a11ySettings.set_boolean('screen-magnifier-enabled', true);

        // Configura o comportamento da lupa para seguir o mouse (Essencial para o efeito XFCE)
        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        
        // Opções de mouse-tracking: 'none' (0), 'centered' (1), 'proportional' (2), 'push' (3)
        // 2 (proportional) é o que mais se aproxima do comportamento do XFCE
        this._settings.set_enum('mouse-tracking', 2);

        // Conecta ao estágio global para capturar eventos de input antes de qualquer outro ator
        // O uso de 'captured-event' no 'global.stage' é a forma mais robusta de interceptação global
        this._eventHandlerId = global.stage.connect('captured-event', (actor, event) => {
            try {
                return this._handleEvent(event);
            } catch (e) {
                console.error(`Deperto Error: ${e}`);
                return Clutter.EVENT_PROPAGATE;
            }
        });
        
        console.log("Deperto (Zoom by Scroll): Extensão iniciada com sucesso.");
    }

    disable() {
        if (this._eventHandlerId) {
            global.stage.disconnect(this._eventHandlerId);
            this._eventHandlerId = null;
        }
        this._settings = null;
        this._a11ySettings = null;
        console.log("Deperto (Zoom by Scroll): Extensão desativada.");
    }

    _handleEvent(event) {
        // 1. Filtra apenas eventos de Scroll
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        // 2. Verifica se a tecla ALT está pressionada
        // Em versoes mais novas do GNOME (45+), global.get_pointer foi removido/depreciado.
        // Devemos confiar no event.get_state().
        const state = event.get_state();
        const isAltPressed = (state & Clutter.ModifierType.MOD1_MASK) !== 0;

        if (!isAltPressed) {
            return Clutter.EVENT_PROPAGATE;
        }

        // 3. Identifica a direção e intensidade do scroll
        const direction = event.get_scroll_direction();
        let zoomChange = 0;
        const ZOOM_STEP = 0.25;

        if (direction === Clutter.ScrollDirection.UP) {
            zoomChange = ZOOM_STEP;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            zoomChange = -ZOOM_STEP;
        } else if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            // dy < 0 é scroll para cima (zoom in), dy > 0 é scroll para baixo (zoom out)
            zoomChange = -dy * ZOOM_STEP; 
        } else {
            return Clutter.EVENT_PROPAGATE;
        }

        // Se a mudança for insignificante, ignora para evitar jitter
        if (Math.abs(zoomChange) < 0.005) {
             return Clutter.EVENT_PROPAGATE;
        }
        
        // 4. Calcula e aplica o novo fator de Zoom
        let currentZoom = this._settings.get_double('mag-factor');
        let newZoom = Math.max(1.0, Math.min(10.0, currentZoom + zoomChange));

        if (newZoom !== currentZoom) {
            this._settings.set_double('mag-factor', newZoom);
            // Retorna EVENT_STOP para que o app sob o mouse não receba o scroll
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }
}

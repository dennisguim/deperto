import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        this._eventHandlerId = null;
        
        // Configura o comportamento da lupa para seguir o mouse (Essencial para o efeito XFCE)
        this._settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        
        // Opções: 'none', 'centered', 'proportional', 'push'
        // 'proportional' ou 'centered' dão o efeito de zoom no ponto do mouse
        this._settings.set_enum('mouse-tracking', 2); // 2 = proportional

        // Conecta ao estágio global para capturar eventos de input
        this._eventHandlerId = global.stage.connect('captured-event', (actor, event) => {
            return this._handleEvent(event);
        });
    }

    disable() {
        if (this._eventHandlerId) {
            global.stage.disconnect(this._eventHandlerId);
            this._eventHandlerId = null;
        }
        this._settings = null;
    }

    _handleEvent(event) {
        // 1. Verifica se é um evento de Scroll
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        // 2. Verifica se a tecla ALT está pressionada
        const state = event.get_state();
        const isAltPressed = (state & Clutter.ModifierType.MOD1_MASK) !== 0;

        if (!isAltPressed) {
            return Clutter.EVENT_PROPAGATE;
        }

        // 3. Identifica a direção do scroll
        const direction = event.get_scroll_direction();
        const magnifier = Main.magnifier;
        
        // Obtém o fator de zoom atual da primeira região de zoom
        let currentZoom = 1.0;
        let regions = magnifier.getZoomRegions();
        
        if (regions.length > 0) {
            let factors = regions[0].getMagFactor();
            // getMagFactor returns an array [x, y] usually
            if (Array.isArray(factors)) {
                currentZoom = factors[0];
            } else {
                currentZoom = factors;
            }
        }

        const ZOOM_STEP = 0.25; // Adjusted step
        let newZoom = currentZoom;

        if (direction === Clutter.ScrollDirection.UP) {
            newZoom += ZOOM_STEP;
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            newZoom -= ZOOM_STEP;
        } else {
            return Clutter.EVENT_PROPAGATE;
        }

        // Limites
        if (newZoom < 1.0) newZoom = 1.0;
        if (newZoom > 10.0) newZoom = 10.0;

        // 4. Aplica o Zoom
        if (regions.length > 0) {
            regions[0].setMagFactor(newZoom, newZoom);
        }

        // Retorna EVENT_STOP para que a janela abaixo não receba o scroll
        return Clutter.EVENT_STOP;
    }
}

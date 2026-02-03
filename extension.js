import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class ZoomByScrollExtension extends Extension {
    enable() {
        console.log("[Deperto] Enabling extension: Super + Alt + Scroll Zoom");

        // 1. Configurar Gerenciador de Janelas (Forçar Super)
        this._wmSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.preferences' });
        this._originalWmModifier = this._wmSettings.get_string('mouse-button-modifier');
        
        // Define explicitamente para Super, permitindo que Alt fique livre para nossa combinação
        this._wmSettings.set_string('mouse-button-modifier', '<Super>');

        // 2. Configurar Magnifier (Zoom)
        this._a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.applications' });
        this._originalMagnifierEnabled = this._a11ySettings.get_boolean('screen-magnifier-enabled');
        // Garante que o recurso de magnifier esteja habilitado no sistema
        this._a11ySettings.set_boolean('screen-magnifier-enabled', true);

        this._magSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.magnifier' });
        this._originalMouseTracking = this._magSettings.get_enum('mouse-tracking');
        // Força o modo 'proportional' para o zoom seguir o mouse
        this._magSettings.set_enum('mouse-tracking', 2); 

        // 3. Capturar Eventos
        this._stageSignalId = global.stage.connect('captured-event', this._onCapturedEvent.bind(this));
    }

    disable() {
        console.log("[Deperto] Disabling extension...");

        // 1. Desconectar Eventos
        if (this._stageSignalId) {
            global.stage.disconnect(this._stageSignalId);
            this._stageSignalId = null;
        }

        // 2. Restaurar configurações originais
        if (this._wmSettings) {
            // Restaura a tecla de ação de janela anterior (ou mantém Super se falhar)
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
    }

    _onCapturedEvent(actor, event) {
        // Só nos interessa evento de SCROLL
        if (event.type() !== Clutter.EventType.SCROLL) {
            return Clutter.EVENT_PROPAGATE;
        }

        const state = event.get_state();
        
        // Verifica modificadores: Precisamos de SUPER (Mod4) E ALT (Mod1)
        const hasSuper = (state & Clutter.ModifierType.MOD4_MASK) !== 0;
        const hasAlt = (state & Clutter.ModifierType.MOD1_MASK) !== 0;

        // Se não tiver a combinação exata Super + Alt, deixa o sistema lidar
        if (!hasSuper || !hasAlt) {
            return Clutter.EVENT_PROPAGATE;
        }

        // Lógica de Zoom
        const direction = event.get_scroll_direction();
        let zoomChange = 0;
        const ZOOM_STEP = 0.25; // Sensibilidade do zoom

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            // dy negativo é scroll para cima (zoom in)
            zoomChange = -dy * ZOOM_STEP; 
        } else {
            if (direction === Clutter.ScrollDirection.UP) {
                zoomChange = ZOOM_STEP;
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                zoomChange = -ZOOM_STEP;
            }
        }

        // Evita processamento desnecessário para movimentos minúsculos
        if (Math.abs(zoomChange) < 0.001) return Clutter.EVENT_STOP;

        // Aplica o novo zoom
        let currentZoom = this._magSettings.get_double('mag-factor');
        let newZoom = currentZoom + zoomChange;

        // Limites de segurança (1.0x a 20.0x)
        if (newZoom < 1.0) newZoom = 1.0;
        if (newZoom > 20.0) newZoom = 20.0;

        if (newZoom !== currentZoom) {
            this._magSettings.set_double('mag-factor', newZoom);
        }

        return Clutter.EVENT_STOP; // Impede que o scroll afete a janela/app abaixo
    }
}

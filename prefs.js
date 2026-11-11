import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ZoomByScrollPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Create a settings object using the schema defined in metadata.json
        const settings = this.getSettings();

        // Create a page
        const page = new Adw.PreferencesPage();
        window.add(page);

        // Create a group
        const group = new Adw.PreferencesGroup({
            title: _('Shortcuts'),
            description: _('Configure how to trigger the zoom'),
        });
        page.add(group);

        // Define the available options
        const optionItems = ['super-alt', 'ctrl-super', 'super'];
        const optionLabels = ['Super + Alt + Scroll', 'Ctrl + Super + Scroll', 'Super + Scroll'];

        // Create the combo row for modifier key
        const row = new Adw.ComboRow({
            title: _('Activation Shortcut'),
            subtitle: _('Key combination to hold while scrolling'),
            model: new Gtk.StringList({
                strings: optionLabels
            }),
        });
        group.add(row);

        // Set initial selection from current settings
        const current = settings.get_string('modifier-key');
        let index = optionItems.indexOf(current);
        
        // If current setting is invalid or not in our new restricted list, default to first option (super-alt)
        if (index === -1) {
            index = 0;
            settings.set_string('modifier-key', optionItems[0]);
        }
        row.set_selected(index);

        // Connect signal to save setting when selection changes
        row.connect('notify::selected', () => {
            const selectedIndex = row.get_selected();
            if (selectedIndex !== -1 && selectedIndex < optionItems.length) {
                settings.set_string('modifier-key', optionItems[selectedIndex]);
            }
        });

        // Create a new group for Zoom Behavior
        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Zoom Behavior'),
            description: _('Configure zoom speed and sensitivity'),
        });
        page.add(behaviorGroup);

        // Zoom Step Setting (SpinRow)
        const zoomStepRow = new Adw.SpinRow({
            title: _('Zoom Step (Sensitivity)'),
            subtitle: _('How much each scroll wheel tick changes the zoom level'),
            adjustment: new Gtk.Adjustment({
                value: settings.get_double('zoom-step'),
                lower: 0.01,
                upper: 1.0,
                step_increment: 0.05,
                page_increment: 0.1,
            }),
            digits: 2,
        });
        behaviorGroup.add(zoomStepRow);

        // Bind the setting directly
        settings.bind(
            'zoom-step',
            zoomStepRow,
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Invert Scroll Toggle (SwitchRow)
        const invertRow = new Adw.SwitchRow({
            title: _('Invert Scroll Direction'),
            subtitle: _('Reverse the zoom direction (e.g. for natural scrolling)'),
        });
        behaviorGroup.add(invertRow);
        settings.bind('invert-scroll', invertRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        // Smooth Zoom Toggle (SwitchRow)
        const smoothZoomRow = new Adw.SwitchRow({
            title: _('Smooth Zoom'),
            subtitle: _('Enable animation for smoother transitions (may cause lag on slow hardware)'),
        });
        behaviorGroup.add(smoothZoomRow);

        // Bind the setting directly
        settings.bind(
            'smooth-zoom',
            smoothZoomRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}
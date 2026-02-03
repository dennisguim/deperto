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

        // Create the combo row for modifier key
        const row = new Adw.ComboRow({
            title: _('Activation Shortcut'),
            subtitle: _('Key combination to hold while scrolling'),
            model: new Gtk.StringList({
                strings: [
                    'Super + Scroll',
                    'Alt + Scroll',
                    'Super + Alt + Scroll',
                    'Shift + Super + Scroll',
                    'Shift + Alt + Scroll',
                    'Ctrl + Super + Scroll',
                    'Ctrl + Alt + Scroll'
                ]
            }),
        });
        group.add(row);

        // Map the index to the string value in GSettings
        const items = ['super', 'alt', 'super-alt', 'shift-super', 'shift-alt', 'ctrl-super', 'ctrl-alt'];

        // Set initial selection from current settings
        const current = settings.get_string('modifier-key');
        const index = items.indexOf(current);
        if (index !== -1) {
            row.set_selected(index);
        } else {
            // Default to Super if unknown
            row.set_selected(0);
        }

        // Connect signal to save setting when selection changes
        row.connect('notify::selected', () => {
            const selectedIndex = row.get_selected();
            if (selectedIndex !== -1 && selectedIndex < items.length) {
                settings.set_string('modifier-key', items[selectedIndex]);
            }
        });
    }
}

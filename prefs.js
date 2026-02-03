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
        const optionItems = ['super-alt', 'ctrl-super'];
        const optionLabels = ['Super + Alt + Scroll', 'Ctrl + Super + Scroll'];

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
    }
}
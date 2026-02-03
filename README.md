# 🔍 Deperto (Zoom by Scroll)

**Stop squinting. Your eyes will thank you.**

Ever tried to read 8px font on a 4K monitor and felt your soul leaving your body? Or maybe you just migrated from **XFCE** and your muscle memory is screaming because you can't just zoom in on a specific pixel anymore?

Nice!

## 🚀 What does it do?
It brings the legendary **XFCE-style Zoom** to GNOME Shell.

- **Point** your mouse at something interesting.
- **Hold** the `Super` (Windows) key.
- **Scroll** the wheel.
- **BOOM.** Instant zoom exactly where you are looking.

It uses the native GNOME magnifier but forces it to behave like a sane tool: `proportional` tracking. That means the zoom follows your cursor, not the center of the screen.

## 🎮 How to use
1. Hold the **Super** key (the one with the Windows logo).
2. **Scroll Up** to zoom in (ENHANCE!).
3. **Scroll Down** to zoom out.

### ⚠️ A Note on "Super + Scroll"
In standard GNOME, `Super + Scroll` might be used to switch workspaces.
**Not anymore.**
~~This extension hijacks that shortcut. We stole it. It's ours now.~~ **This isn't really the case anymore, but I'm keeping it because I like the
  humor.**

## 🌟 What's New? (The "I'm in Control" Update)

I realized that one size doesn't fit all, especially when it comes to finger gymnastics. Here is what we added:

### ⌨️ Choose Your Own Adventure (Custom Shortcuts)
You are no longer locked into the `Super` key. Head over to the **Extension Preferences** and pick your poison. 
Options include `Alt`, `Ctrl + Alt`, `Shift + Super`, and more. If you want to feel like you're hacking the mainframe every time you zoom, now's your chance.

### 🔄 The Great Workspace Swap
Since we borrowed your primary scroll shortcut for zooming, we decided to give you a replacement so you don't get stuck in one workspace forever:
*   **If you zoom with Super:** Use `Alt + Scroll` to switch workspaces.
*   **If you zoom with Alt:** Use `Super + Scroll` to switch workspaces.
It's like a peaceful hostage exchange. Everyone wins.

### 🛠️ "Windows Action Key" Auto-Sync
To make sure zooming works perfectly even when your mouse is hovering over a busy window, Deperto now automatically adjusts your system's **"Windows Action Key"** (the modifier used to drag windows) to match your zoom key. 
If you notice your window-dragging key changed—don't call a priest, it's just the extension making sure your zoom is uninterrupted.

## 📦 Installation

### Manual Installation
1. Download this repository.
2. Copy the folder to your extensions directory:
   ```bash
   cp -r . ~/.local/share/gnome-shell/extensions/deperto@dennisguim.com
   ```
3. Restart GNOME Shell (Log out/in on Wayland, or `Alt+F2`, type `r`, Enter on X11).
4. Enable via **Extensions** app.


---
*Made with ❤️.  Brasil sil sil!

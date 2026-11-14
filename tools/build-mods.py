#!/usr/bin/env python3
# Builds the standalone Over9k mods from the layout's mods (over9k/mods, the one
# source): each folder at the repo's top (over9k-todo/, ...) gets mods/<name>/
# copies, a mod.json that docks it on its own, the scripts it needs and its
# keys.json. RECIPE.md and preview.png in each folder are written by hand and
# never touched here; the previews are copied into over9k/previews/ for the
# layout's RECIPE.md. Run it after changing anything under over9k/mods:
#   python3 tools/build-mods.py
import json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "over9k", "mods")
SKIP = {"gpui-kit.d.ts", "herdr.d.ts", "jsconfig.json", "__pycache__"}
LAYOUT_KEYS = json.load(open(os.path.join(ROOT, "over9k", "keys.json")))
# macOS: Cmd where it expects it (keys.macos.json; the installers pick it there).
LAYOUT_KEYS_MAC = json.load(open(os.path.join(ROOT, "over9k", "keys.macos.json")))

SHARES = {
    # The sidebar, with every overlay it opens (menus, dialogs, Help & Options).
    "over9k-sidebar": {
        "mods": ["over9k", "over9k-menu", "over9k-new-menu", "over9k-server-stop", "over9k-rename",
                 "over9k-close", "over9k-handoff", "over9k-panel", "over9k-switcher", "over9k-options"],
        "place": {"over9k": {"place": "left", "size": 268}},
        "keys": LAYOUT_KEYS,
        "keys_macos": LAYOUT_KEYS_MAC,
    },
    # The + menu on a key: start agents and CLIs, resume chats, local models.
    "over9k-launcher": {
        "mods": ["over9k-new-menu", "over9k-server-stop"],
        "place": {"over9k-new-menu": {"place": "none", "overlay": {"width": 340, "height": 640}}},
        "keys": {"global": {"ctrl-shift-a": "mod.open:over9k-new-menu"}},
        "keys_macos": {"global": {"cmd-shift-a": "mod.open:over9k-new-menu"}},
    },
    "over9k-todo": {
        "mods": ["over9k-todos"],
        "place": {"over9k-todos": {"place": "right", "size": 368}},
        "extra": {"over9k-todos": [("over9k-options", "setup.sh")]},
    },
    "over9k-timeline": {
        "mods": ["over9k-prompts"],
        "place": {"over9k-prompts": {"place": "right", "size": 368}},
        "extra": {"over9k-prompts": [("over9k", "claude-info.py")]},
    },
    "over9k-usage": {
        "mods": ["over9k-usage"],
        "place": {"over9k-usage": {"place": "bottom", "size": 30}},
        "extra": {"over9k-usage": [("over9k-options", "setup.sh"), ("over9k", "claude-statusline.sh")]},
    },
    "over9k-switcher": {
        "mods": ["over9k-switcher"],
        "place": {"over9k-switcher": {"place": "none", "focusable": True, "overlay": {"width": 460, "height": 420}}},
        "keys": {"global": {"ctrl-tab": "mod.open:over9k-switcher"},
                 "mod:over9k-switcher": {"ctrl-tab": "over9k-switcher.next", "ctrl-shift-tab": "over9k-switcher.prev"}},
    },
}


def copy_mod(name, dest):
    src = os.path.join(SRC, name)
    if os.path.exists(dest):
        shutil.rmtree(dest)
    shutil.copytree(src, dest, ignore=lambda d, names: [n for n in names if n in SKIP or n.endswith(".pyc")])


def main():
    for share, spec in SHARES.items():
        base = os.path.join(ROOT, share)
        mods = os.path.join(base, "mods")
        os.makedirs(base, exist_ok=True)
        if os.path.exists(mods):
            shutil.rmtree(mods)
        for name in spec["mods"]:
            copy_mod(name, os.path.join(mods, name))
        for name, place in spec.get("place", {}).items():
            path = os.path.join(mods, name, "mod.json")
            meta = json.load(open(path))
            meta.update(place)
            with open(path, "w") as f:
                json.dump(meta, f, indent=2)
                f.write("\n")
        for name, files in spec.get("extra", {}).items():
            for src_mod, fname in files:
                shutil.copy2(os.path.join(SRC, src_mod, fname), os.path.join(mods, name, fname))
        for fname, field in (("keys.json", "keys"), ("keys.macos.json", "keys_macos")):
            keys = os.path.join(base, fname)
            if spec.get(field):
                with open(keys, "w") as f:
                    json.dump(spec[field], f, indent=2)
                    f.write("\n")
            elif os.path.exists(keys):
                os.remove(keys)
        print(f"{share}: {', '.join(spec['mods'])}")
    # Each mod's picture, also in the layout's folder, for its RECIPE.md.
    pics = os.path.join(ROOT, "over9k", "previews")
    os.makedirs(pics, exist_ok=True)
    for share in SHARES:
        src = os.path.join(ROOT, share, "preview.png")
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(pics, f"{share}.png"))


main()

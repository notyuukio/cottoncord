/**
 * @name HideIconBadge
 * @description Hides the badge on the app icon and tray icon.
 * @version 0.0.6
 * @author Zerebos
 * @authorId 249746236008169473
 * @website https://github.com/zerebos/BetterDiscordAddons/tree/master/Plugins/HideIconBadge
 * @source https://raw.githubusercontent.com/zerebos/BetterDiscordAddons/master/Plugins/HideIconBadge/HideIconBadge.plugin.js
 */

/*@cc_on
@if (@_jscript)
    
    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/HideIconBadge/index.ts
var HideIconBadge_exports = {};
__export(HideIconBadge_exports, {
  default: () => HideIconBadge
});
module.exports = __toCommonJS(HideIconBadge_exports);

// src/base.ts
var Plugin = class {
  meta;
  manifest;
  settings;
  defaultSettings;
  LocaleManager;
  get strings() {
    if (!this.manifest.strings) return {};
    const locale = this.LocaleManager?.getLocale().split("-")[0] ?? "en";
    if (this.manifest.strings.hasOwnProperty(locale)) return this.manifest.strings[locale];
    if (this.manifest.strings.hasOwnProperty("en")) return this.manifest.strings.en;
    return this.manifest.strings;
  }
  constructor(meta, zplConfig) {
    this.meta = meta;
    this.manifest = zplConfig;
    if (typeof this.manifest.config !== "undefined") {
      this.defaultSettings = {};
      for (let s = 0; s < this.manifest.config.length; s++) {
        const current = this.manifest.config[s];
        if (current.type != "category") {
          this.defaultSettings[current.id] = current.value;
        } else {
          for (let si = 0; si < current.settings.length; si++) {
            const subCurrent = current.settings[si];
            this.defaultSettings[subCurrent.id] = subCurrent.value;
          }
        }
      }
      this.settings = BdApi.Utils.extend({}, this.defaultSettings);
    }
    const currentVersionInfo = BdApi.Data.load(this.meta.name, "version");
    if (currentVersionInfo !== this.meta.version) {
      this.#showChangelog();
      BdApi.Data.save(this.meta.name, "version", this.meta.version);
    }
    if (this.manifest.strings) this.LocaleManager = BdApi.Webpack.getModule((m) => m?.Messages && Object.keys(m?.Messages).length > 0);
    if (this.manifest.config) {
      this.getSettingsPanel = () => {
        return BdApi.UI.buildSettingsPanel({
          onChange: (_, id, value) => {
            this.settings[id] = value;
            this.saveSettings();
          },
          settings: this.manifest.config
        });
      };
    }
  }
  async start() {
    BdApi.Logger.info(this.meta.name, `version ${this.meta.version} has started.`);
    if (this.defaultSettings) this.settings = this.loadSettings();
    if (typeof this.onStart == "function") this.onStart();
  }
  stop() {
    BdApi.Logger.info(this.meta.name, `version ${this.meta.version} has stopped.`);
    if (typeof this.onStop == "function") this.onStop();
  }
  #showChangelog() {
    if (typeof this.manifest.changelog == "undefined") return;
    const changelog = {
      title: this.meta.name + " Changelog",
      subtitle: `v${this.meta.version}`,
      changes: []
    };
    if (!Array.isArray(this.manifest.changelog)) Object.assign(changelog, this.manifest.changelog);
    else changelog.changes = this.manifest.changelog;
    BdApi.UI.showChangelogModal(changelog);
  }
  saveSettings() {
    BdApi.Data.save(this.meta.name, "settings", this.settings);
  }
  loadSettings() {
    return BdApi.Utils.extend({}, BdApi.Data.load(this.meta.name, "settings"), this.defaultSettings ?? {});
  }
  buildSettingsPanel(onChange) {
    return BdApi.UI.buildSettingsPanel({
      onChange: (groupId, id, value) => {
        this.settings[id] = value;
        onChange?.(groupId, id, value);
        this.saveSettings();
      },
      settings: this.manifest.config
    });
  }
};

// src/HideIconBadge/config.ts
var manifest = {
  info: {
    name: "HideIconBadge",
    authors: [{
      name: "Zerebos",
      discord_id: "249746236008169473",
      github_username: "zerebos",
      twitter_username: "IAmZerebos"
    }],
    version: "0.0.6",
    description: "Hides the badge on the app icon and tray icon.",
    github: "https://github.com/zerebos/BetterDiscordAddons/tree/master/Plugins/HideIconBadge",
    github_raw: "https://raw.githubusercontent.com/zerebos/BetterDiscordAddons/master/Plugins/HideIconBadge/HideIconBadge.plugin.js"
  },
  changelog: [
    { title: "What's New?", type: "added", items: ["No longer depends on ZeresPluginLibrary!"] }
  ],
  main: "index.ts"
};
var config_default = manifest;

// src/HideIconBadge/index.ts
var ElectronModule = BdApi.Webpack.getByKeys("setBadge");
var HideIconBadge = class extends Plugin {
  constructor(meta) {
    super(meta, config_default);
  }
  onStart() {
    if (!ElectronModule) return;
    ElectronModule?.setBadge(0);
    BdApi.Patcher.before(this.meta.name, ElectronModule, "setBadge", (_, args) => {
      args[0] = 0;
    });
    ElectronModule?.setSystemTrayIcon("DEFAULT");
    BdApi.Patcher.before(this.meta.name, ElectronModule, "setSystemTrayIcon", (_, args) => {
      if (args[0] === "UNREAD") args[0] = "DEFAULT";
    });
  }
  onStop() {
    BdApi.Patcher.unpatchAll(this.meta.name);
  }
};

/*@end@*/

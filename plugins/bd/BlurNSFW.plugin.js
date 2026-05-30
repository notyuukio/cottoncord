/**
 * @name BlurNSFW
 * @description Blurs images and videos until you hover over them.
 * @version 1.0.5
 * @author Zerebos
 * @authorId 249746236008169473
 * @website https://github.com/zerebos/BetterDiscordAddons/tree/master/Plugins/BlurNSFW
 * @source https://raw.githubusercontent.com/zerebos/BetterDiscordAddons/master/Plugins/BlurNSFW/BlurNSFW.plugin.js
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

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/plugins/BlurNSFW/index.ts
var BlurNSFW_exports = {};
__export(BlurNSFW_exports, {
  default: () => BlurMedia
});
module.exports = __toCommonJS(BlurNSFW_exports);

// src/common/plugin.ts
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
    if (this.manifest.config && !this.getSettingsPanel) {
      this.getSettingsPanel = () => {
        this.#updateConfig();
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
    return BdApi.Utils.extend({}, this.defaultSettings ?? {}, BdApi.Data.load(this.meta.name, "settings"));
  }
  #updateConfig() {
    if (!this.manifest.config) return;
    for (const setting of this.manifest.config) {
      if (setting.type !== "category") {
        setting.value = this.settings[setting.id] ?? setting.value;
      } else {
        for (const subsetting of setting.settings) {
          subsetting.value = this.settings[subsetting.id] ?? subsetting.value;
        }
      }
    }
  }
  buildSettingsPanel(onChange) {
    this.#updateConfig();
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

// src/common/formatstring.ts
function formatString(stringToFormat, values) {
  for (const val in values) {
    let replacement = values[val];
    if (Array.isArray(replacement)) replacement = JSON.stringify(replacement);
    if (typeof replacement === "object" && replacement !== null) replacement = replacement.toString();
    stringToFormat = stringToFormat.replace(new RegExp(`{{${val}}}`, "g"), replacement.toString());
  }
  return stringToFormat;
}

// src/plugins/BlurNSFW/config.ts
var manifest = {
  info: {
    name: "BlurNSFW",
    authors: [{
      name: "Zerebos",
      discord_id: "249746236008169473",
      github_username: "zerebos",
      twitter_username: "IAmZerebos"
    }],
    version: "1.0.5",
    description: "Blurs images and videos until you hover over them.",
    github: "https://github.com/zerebos/BetterDiscordAddons/tree/master/Plugins/BlurNSFW",
    github_raw: "https://raw.githubusercontent.com/zerebos/BetterDiscordAddons/master/Plugins/BlurNSFW/BlurNSFW.plugin.js"
  },
  changelog: [
    {
      title: "What's New?",
      type: "added",
      items: [
        "Plugin no longer relies on ZeresPluginLibrary!"
      ]
    },
    {
      title: "Bug Fixes & Info",
      type: "fixed",
      items: [
        "The settings panel will now reflect your actual settings.",
        "Media should be blurred properly once again!",
        "If things aren't blurred properly for you, it might be due to an experiment Discord is doing.",
        "Once the experiment is more widely rolled out, I will add compatibility for it in this plugin."
      ]
    }
  ],
  config: [
    {
      type: "switch",
      id: "blurNSFW",
      name: "Blur NSFW Channels",
      note: "This setting automatically blurs media in channels marked NSFW.",
      value: true
    },
    {
      type: "slider",
      id: "blurSize",
      name: "Blur Size",
      note: "The size (in px) of the blurred pixels.",
      value: 10,
      min: 0,
      max: 50,
      units: "px"
    },
    {
      type: "slider",
      id: "blurTime",
      name: "Blur Time",
      note: "The time (in ms) it takes for the blur to disappear and reappear.",
      value: 200,
      min: 0,
      max: 5e3,
      units: "ms"
    },
    {
      type: "switch",
      id: "blurOnFocus",
      name: "Blur When Focused",
      note: "This setting keeps the blur when clicking on/expanding an image.",
      value: true
    }
  ],
  main: "index.ts"
};
var config_default = manifest;

// src/plugins/BlurNSFW/index.ts
var import_events = __toESM(require("events"), 1);
var { ContextMenu, DOM, Webpack, Patcher } = BdApi;
var SelectedChannelStore = Webpack.getModule((m) => m.getCurrentlySelectedChannelId);
var ChannelStore = Webpack.getModule((m) => m.getDMFromUserId);
var InlineMediaWrapper = Webpack.getByPrototypeKeys("getSrc", "getRatio");
var WrapperClasses = Webpack.getModule((m) => m.wrapperPlaying);
var Dispatcher = new import_events.default();
var STYLES = `
{{blurOnFocus}}
.${WrapperClasses?.wrapperPlaying.split(" ").join(".")} video,
.${WrapperClasses?.wrapperControlsHidden.split(" ").join(".")} video,
.blur:hover img,
.blur:hover video,
a:hover + div > .blur {
    transition: {{time}}ms cubic-bezier(.2, .11, 0, 1) !important;
    filter: blur(0px) !important;
}

.blur img,
.blur video {
    filter: blur({{size}}px) !important;
    transition: {{time}}ms cubic-bezier(.2, .11, 0, 1) !important;
}`;
var BlurMedia = class extends Plugin {
  constructor(meta) {
    super(meta, config_default);
    this.meta = meta;
    this.contextPatches = [];
    this.channelChange = this.channelChange.bind(this);
  }
  blurredChannels;
  seenChannels;
  contextPatches;
  onStart() {
    this.blurredChannels = new Set(BdApi.Data.load(this.meta.name, "blurred") ?? []);
    this.seenChannels = new Set(BdApi.Data.load(this.meta.name, "seen") ?? []);
    if (!InlineMediaWrapper || !InlineMediaWrapper.prototype) return;
    Patcher.after(this.meta.name, InlineMediaWrapper.prototype, "render", (_, __, retVal) => {
      const channel = ChannelStore?.getChannel(SelectedChannelStore?.getChannelId() ?? "");
      if (!this.hasBlur(channel)) return;
      if (retVal.props.className) retVal.props.className = retVal.props.className + " blur";
      else retVal.props.className = "blur";
    });
    Patcher.after(this.meta.name, InlineMediaWrapper.prototype, "componentDidMount", (thisObject) => {
      if (thisObject.cancelBlurListener) return;
      const listener = () => thisObject.forceUpdate();
      Dispatcher.on("blur", listener);
      thisObject.cancelBlurListener = () => Dispatcher.off("blur", listener);
    });
    Patcher.after(this.meta.name, InlineMediaWrapper.prototype, "componentWillUnmount", (thisObject) => {
      if (!thisObject.cancelBlurListener) return;
      thisObject.cancelBlurListener();
      delete thisObject.cancelBlurListener;
    });
    this.addStyle();
    SelectedChannelStore?.addChangeListener(this.channelChange);
    this.patchContextMenus();
  }
  onStop() {
    BdApi.Data.save(this.meta.name, "blurred", this.blurredChannels);
    BdApi.Data.save(this.meta.name, "seen", this.seenChannels);
    this.contextPatches.forEach((cancel) => cancel());
    this.removeStyle();
    SelectedChannelStore?.removeChangeListener(this.channelChange);
  }
  hasBlur(channel) {
    if (!channel) return false;
    return this.blurredChannels.has(channel.id);
  }
  addBlur(channel) {
    if (!channel) return;
    this.blurredChannels.add(channel.id);
    Dispatcher.emit("blur");
    BdApi.Data.save(this.meta.name, "blurred", this.blurredChannels);
  }
  removeBlur(channel) {
    if (!channel) return;
    this.blurredChannels.delete(channel.id);
    Dispatcher.emit("blur");
    BdApi.Data.save(this.meta.name, "blurred", this.blurredChannels);
  }
  channelChange() {
    const channel = ChannelStore?.getChannel(SelectedChannelStore?.getChannelId() ?? "");
    if (!channel?.id || this.seenChannels.has(channel.id)) return;
    this.seenChannels.add(channel.id);
    BdApi.Data.save(this.meta.name, "seen", this.seenChannels);
    if (this.settings.blurNSFW && channel.nsfw) this.addBlur(channel);
  }
  patchContextMenus() {
    const patchFunction = (retVal, props) => {
      const newItem = ContextMenu.buildItem({
        type: "toggle",
        label: "Blur Media",
        active: this.hasBlur(props.channel),
        action: () => {
          if (this.hasBlur(props.channel)) this.removeBlur(props.channel);
          else this.addBlur(props.channel);
        }
      });
      retVal.props?.children?.splice(1, 0, newItem);
    };
    ["user-context", "channel-context", "gdm-context"].forEach((contextName) => {
      this.contextPatches.push(ContextMenu.patch(contextName, patchFunction));
    });
  }
  addStyle() {
    const styleString = formatString(STYLES, {
      size: Math.round(this.settings.blurSize),
      time: Math.round(this.settings.blurTime),
      blurOnFocus: this.settings.blurOnFocus ? "" : ".layer-1Ixpg3 .blur img,"
    });
    DOM.addStyle(this.meta.name, styleString);
  }
  removeStyle() {
    DOM.removeStyle(this.meta.name);
  }
  getSettingsPanel() {
    return this.buildSettingsPanel(() => {
      this.removeStyle();
      this.addStyle();
    });
  }
};

/*@end@*/
/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "F8Break",
    description: "Pause the client when you press F8 with DevTools (+ breakpoints) open.",
    tags: ["Developers", "Shortcuts"],
    authors: [Devs.lewisakura],

    start() {
        window.addEventListener("keydown", this.event);
    },

    stop() {
        window.removeEventListener("keydown", this.event);
    },

    event(e: KeyboardEvent) {
        if (e.code === "F8") {
            debugger;
        }
    }
});

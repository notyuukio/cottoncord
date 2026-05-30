/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "AlwaysAnimate",
    description: "Animates anything that can be animated",
    tags: ["Appearance", "Fun"],
    authors: [Devs.FieryFlames],

    patches: [
        {
            find: "canAnimate:",
            all: true,
            noWarn: true,
            replacement: {
                match: /canAnimate:.+?([,}].*?\))/g,
                replace: (m, rest) => {
                    const destructuringMatch = rest.match(/}=.+/);
                    if (destructuringMatch == null) return `canAnimate:!0${rest}`;
                    return m;
                }
            }
        },
        {
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: {
                match: /(\.CUSTOM_STATUS.+?animateEmoji:)\i/,
                replace: "$1!0"
            }
        },
        {
            find: "#{intl::DISCOVERABLE_GUILD_HEADER_PUBLIC_INFO}",
            replacement: {
                match: /(guildBanner:\i,animate:)\i(?=}\):null)/,
                replace: "$1!0"
            }
        },
        {
            find: ".MINI_PREVIEW,[",
            replacement: {
                match: /animate:\i,loop:/,
                replace: "animate:true,loop:true,_loop:"
            }
        }
    ]
});

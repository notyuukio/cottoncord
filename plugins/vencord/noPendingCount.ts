/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

const MessageRequestStore = findByPropsLazy("getMessageRequestsCount");

const settings = definePluginSettings({
    hideFriendRequestsCount: {
        type: OptionType.BOOLEAN,
        description: "Hide incoming friend requests count",
        default: true,
        restartNeeded: true
    },
    hideMessageRequestsCount: {
        type: OptionType.BOOLEAN,
        description: "Hide message requests count",
        default: true,
        restartNeeded: true
    },
    hidePremiumOffersCount: {
        type: OptionType.BOOLEAN,
        description: "Hide nitro offers count",
        default: true,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "NoPendingCount",
    description: "Removes the ping count of incoming friend requests, message requests, and nitro offers.",
    tags: ["Notifications", "Appearance"],
    authors: [Devs.amia],
    settings,
    patches: [
        {
            find: "getPendingCount(){",
            predicate: () => settings.store.hideFriendRequestsCount,
            replacement: {
                match: /(?<=getPendingCount\(\)\{)/,
                replace: "return 0;"
            }
        },
        {
            find: "getMessageRequestsCount(){",
            predicate: () => settings.store.hideMessageRequestsCount,
            replacement: {
                match: /(?<=getMessageRequestsCount\(\)\{)/,
                replace: "return 0;"
            }
        },
        {
            find: ".getSpamChannelsCount();return",
            predicate: () => settings.store.hideMessageRequestsCount,
            replacement: {
                match: /(?<=getSpamChannelsCount\(\);return )\i\.getMessageRequestsCount\(\)/,
                replace: "$self.getRealMessageRequestCount()"
            }
        },
        {
            find: "showProgressBadge:",
            predicate: () => settings.store.hidePremiumOffersCount,
            replacement: {
                match: /(\{unviewedTrialCount:(\i),unviewedDiscountCount:(\i)\}.+?)\2\+\3/,
                replace: (_, rest) => `${rest}0`
            }
        }
    ],
    getRealMessageRequestCount() {
        return MessageRequestStore?.getMessageRequestChannelIds?.()?.size ?? 0;
    }
});

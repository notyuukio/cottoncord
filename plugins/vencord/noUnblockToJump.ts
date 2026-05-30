/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Sofia Lima
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoUnblockToJump",
    description: "Allows you to jump to messages of blocked or ignored users and likely spammers without unblocking them",
    tags: ["Utility"],
    authors: [Devs.dzshn],
    patches: [
        {
            find: "#{intl::UNIGNORE_TO_JUMP_BODY}",
            replacement: {
                match: /if\(\i\.\i\.isBlockedForMessage\(/,
                replace: "return true;$&"
            }
        }
    ]
});

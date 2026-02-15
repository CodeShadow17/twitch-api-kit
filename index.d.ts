export interface HelixOptions {
    client_token: string;
    client_id: string;
    channelName: string;
}

export interface CustomRewardOptions {
    title: string;
    cost: number;
    prompt?: string;
    is_enabled?: boolean;
    background_color?: string;
    is_user_input_required?: boolean;
    is_max_per_stream_enabled?: boolean;
    max_per_stream?: number | null;
    is_max_per_user_per_stream_enabled?: boolean;
    max_per_user_per_stream?: number | null;
    is_global_cooldown_enabled?: boolean;
    global_cooldown_seconds?: number | null;
}

export interface RedemptionStatusOptions {
    redemptionId: string;
    rewardId: string;
    status?: "FULFILLED" | "CANCELED";
}

export interface RedemptionSummary {
    redeemed_by: string;
    user_id: string;
    reward_id: string;
    reward_title: string;
    reward_cost: number;
    reward_status: string;
    reward_redeemed_at: string;
}

export interface RedemptionStatusResult {
    simplified: RedemptionSummary | null;
    full: any | null;
}

export interface CheerLeaderboardEntry {
    userId: string;
    username: string;
    rank: number;
    score: number;
}

export class Helix {
    constructor(options: HelixOptions);

    token: string;
    channel: string;
    client_id: string;
    moderator: string | null;
    broadcaster_id: string | null;
    ready: boolean;

    init(): Promise<void>;
    viewerCount(): Promise<number>;
    getUserID(username: string): Promise<string | null>;
    followCount(): Promise<number>;
    lastFollow(): Promise<string | null>;
    followAge(userId: string): Promise<any | null>;
    emoteNameById(id: string): Promise<string | null>;

    sendShoutout(userId: string, moderatorId?: string): Promise<boolean>;

    createClip(title?: string, duration?: number): Promise<any | null>;

    getChannelRewards(): Promise<any[]>;

    getChatters(moderatorId?: string): Promise<number | null>;

    createCustomReward(options: CustomRewardOptions): Promise<{
        id: string;
        title: string;
        prompt: string;
        cost: number;
    } | null>;

    deleteCustomRewards(rewardId: string): Promise<boolean>;

    updateRedemptionStatus(options: RedemptionStatusOptions): Promise<RedemptionStatusResult>;

    cheerLeaderboard(): Promise<CheerLeaderboardEntry[]>;
}


export interface SubscribeOptions {
    clientId: string;
    token: string;
    broadcasterId?: string | null;
    sessionId?: string | null;
}

export interface SafeFetchResult {
    success: boolean;
    data?: any | null;
    error?: any;
}

export class Subscribe {
    constructor(options: SubscribeOptions);

   client_id: string;
   token: string;
   broadcaster_id: string | null;
   session_id: string | null;
   _eventsub_url: string;

   _canStart(): void;
   _error(message: string, error?: any): Error;
   _headers(): { "Client-ID": string; Authorization: string; "Content-Type": string };
   _withTimeout<T>(promise: (signal: AbortSignal) => Promise<T>, ms?: number): Promise<T>;
   _safeFetch(url: string, options?: any, timeoutMs?: number): Promise<SafeFetchResult>;
   _safeSub(description: string, fn: () => Promise<SafeFetchResult | { success?: boolean; data?: any }>): Promise<boolean>;



   toFollows(): Promise<boolean>;
   toRedemptions(): Promise<boolean>;
   toStreamOnline(): Promise<boolean>;
   toStreamOffline(): Promise<boolean>;
   toChannelUpdate(): Promise<boolean>;
   toAll(): Promise<{
    channelUpdateData: any;
    followData: any;
    redemptionsData: any;
    isOnlineData: any;
    isOfflineData: any;
   }>;
}



declare const _default: {
    Helix: typeof Helix;
    Subscribe: typeof Subscribe;
};

export = _default;
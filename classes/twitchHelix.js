const fetch = require('node-fetch');

class Helix {
    constructor({client_token, client_id, channelName}){
        this.token = client_token;
        this.channel = channelName;
        this.client_id = client_id; //The client id you have, to get it go to https://dev.twitch.tv/console/apps and obtain it from your app
        this.moderator = null; //the user id of the moderator
        this.broadcaster_id = null; //this can be set later on
        this.ready = false;
        this.shoutoutCooldownGlobal = {last: 0};
        this.shoutoutCooldownPerTarget = new Map();
        this.emoteCache = new Map();
    };

    _setBroadcasterId(id){
        this.broadcaster_id = id;
    }

    _error(message, error) {
    return new Error(`${message}: ${error?.message || error}`);
}


    _headers() {
    return {
        "Client-ID": this.client_id,
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json"
    };
}


    async _withTimeout(promise, ms = 5000){
        let timeout;
        const controller = new AbortController();

        const timer = new Promise((_, reject) => {
            timeout = setTimeout(() => {
                controller.abort();
                reject(new Error("Helix request timed out"));
            }, ms);
        });

        try {
            const result = await Promise.race([
                promise(controller.signal),
                timer
            ]);
            return result;
        }catch(error){
            throw this._error(`There was an issue with fetch Timeout:`,error);
        } 
        finally {
            clearTimeout(timeout);
        };
    };

    async _safeFetch(url, options, timeoutMs = 5000){
        try {
            return await this._withTimeout(
                async (signal) => {
                    const res = await fetch(url, {...options, signal});

                    if(res.status === 204) return {success: true}
                    return await res.json();
                },
                timeoutMs
            );
        } catch (error) {
            console.error("Helix fetch failed:", url, error)
            return null;
        }
    };

    async init(){
        const id = await this.getUserID(this.channel);
        this.broadcaster_id = id;
        this.ready = true;
    }

    _checkReady() {
    if (!this.ready) {
        throw new Error("Helix.init() has not been called yet.");
    }
}

    async viewerCount(){
        this._checkReady();
        try {
            return await this._withTimeout(async (signal) => {
        const res = await fetch(
            `https://api.twitch.tv/helix/streams?user_login=${this.channel}`,
            {
                method: "GET",
                headers: this._headers(),
                signal
            }
        );

        const data = await res.json();
        if (data.data.length === 0) return 0;
        return data.data[0].viewer_count;
    }, 3000);
        } catch (error) {
            throw this._error(`There was an error with retrieving Viewer Count`, error );
        }
    };


    async getUserID(username){
        //this._checkReady(); //commented out cause without the init starting and this one always waiting for init to have the id, it goes into a logical loop
        try {
        const data = await this._safeFetch(`https://api.twitch.tv/helix/users?login=${username}`, {
        method: "GET",
        headers: this._headers()
    });

        if (!data || !data.data?.length) { 
        console.error("Broadcaster not found:", username, data); 
        return null; 
        } 

        return data.data[0].id;
        } catch (error) {
            throw this._error(`There was an error obtaining User's twitch Id`, error)
        }
    };


    async followCount(){
        this._checkReady();
        try {
            const data = await this._safeFetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcaster_id}`, {
                method: "GET",
                headers: this._headers()
            });

            if(!data || typeof data.total !== "number"){
            console.error("Follower count error:", data); 
            return 0;
            }
            return data.total;

        } catch (error) {
            throw this._error(`There was an error retrieving the follow count`, error);
        }
    };

    async lastFollow(){
        this._checkReady();
        try {
        const data = await this._safeFetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcaster_id}&first=1`, {
            method: "GET",
            headers: this._headers()
        });

        if (!data?.data?.length) return null;

        return data.data[0].user_login;
        } catch (error) {
            throw this._error(`There was an error retrieving latest follower`, error)
        }
    }

    async followAge(userId){
        this._checkReady();
        try {
           const data = await this._safeFetch(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${this.broadcaster_id}&user_id=${userId}`,
    {
        method: "GET",
      headers: this._headers()
    }
  );

  if (!data || !data.data) return null;

  return data.data[0] || null;
  } catch (error) {
    throw this._error(`There was an error retrieving the follow age of the user`, error);
  }
};


async emoteNameById(id){
    if(this.emoteCache.has(id)) return this.emoteCache.get(id);

    try {
            const data = await this._safeFetch(
    `https://api.twitch.tv/helix/emotes?id=${id}`,
    {
        method: "GET",
      headers: this._headers()
    }
  );

  const name = data?.data?.[0]?.name || null;
  if (name) this.emoteCache.set(id, name);

  return name;
    } catch (error) {
        throw this._error(`There was en error retrieving Emote name by Id`, error)
    }
};

_isShoutoutCooldown(targetId){
  const now = Date.now();

  if(now - this.shoutoutCooldownGlobal.last < 60_000){
    return true
  }

  const lastTarget = this.shoutoutCooldownPerTarget.get(targetId) || 0;
  if(now - lastTarget < 120_000){
    return true;
  }
  return false
};

_setShoutoutCooldown(targetId){
  const now = Date.now();
  this.shoutoutCooldownGlobal.last = now;
  this.shoutoutCooldownPerTarget.set(targetId, now);
};

async sendShoutout(userId, moderatorId){
    this._checkReady();
    try {
        if(this._isShoutoutCooldown(userId)){
            console.log("Shoutout has been skipped due to cooldown");
            return false;
        }

          const url = "https://api.twitch.tv/helix/chat/shoutouts";

  const body = {
    from_broadcaster_id: this.broadcaster_id,
    to_broadcaster_id: userId,
    moderator_id: moderatorId ?? this.broadcaster_id
  };

  const data = await this._safeFetch(url, {
    method: "POST",
    headers: this._headers(),
    body: JSON.stringify(body)
  });

  if(data && data.success){
    this._setShoutoutCooldown(userId);
    return true;
  }
  else return false

    } catch (error) {
        throw this._error(`There was an error using shoutout`, error)
    }
}


async createClip(title = "", duration = 30){
    try{
         const url = "https://api.twitch.tv/helix/clips";
  duration = Math.min(60, Math.max(5, duration));

  const extra = title ? `&title=${encodeURIComponent(title)}` : "";
  const time = duration !== 30 ? `&has_delay=false&duration=${duration}` : "";

  const data = await this._safeFetch(
    `${url}?broadcaster_id=${this.broadcaster_id}${extra}${time}`,
    {
      method: "POST",
      headers: this._headers(),
    }
  );

  if (!data || data.error) {
    console.error("Clip creation failed:", data);
    return null;
  }

  return data.data?.[0] || null;
    }
    catch(error){
        throw this._error("There was an error with the create Clip function", error);
    }
};


async getChannelRewards(){
    const url = `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${this.broadcaster_id}`;

    try {
        const data = await this._safeFetch(url, {
            method: "GET",
            headers: this._headers(),
        });

        if(!data || data.error) {
            console.error("Get rewards failed:", data);
            return [];
        }
        return data.data || [];
    } catch (error) {
        throw this._error("There was an error with getting channel rewards", error);
    }
};


async getChatters(moderatorId){
    const url = `https://api.twitch.tv/helix/chat/chatters`
    const body = {
      broadcaster_id: this.broadcaster_id,
      moderator_id: moderatorId ?? this.broadcaster_id
    };
    try {
        const data = await this._safeFetch(url, {
        method: "GET",
        headers: this._headers(),
        body: JSON.stringify(body)
    });

    if(!data || data.error){
        console.error("Get chatters failed:", error);
        return null
    }
    return typeof data?.total === "number" ? data.total : null;
    } catch (error) {
        throw this._error("There was an error with Getting chatters", error);
    }
};


_randomHexColor(){
    const r = Math.floor(100 + Math.random() * 155);
  const g = Math.floor(100 + Math.random() * 155);
  const b = Math.floor(100 + Math.random() * 155);

  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
};

async createCustomReward({
  title, 
  cost, 
  prompt = "",
  is_enabled = true, 
  background_color,
  is_user_input_required = false,
  is_max_per_stream_enabled = false,
  max_per_stream = null,
  is_max_per_user_per_stream_enabled = false,
  max_per_user_per_stream = null,
  is_global_cooldown_enabled = false,
  global_cooldown_seconds = null
}){
if(!title || !cost) return {error: "Missing title or cost for reward"};

if(!background_color) background_color = this._randomHexColor();

  const rewardToCreate = {
    title: title,
    prompt: prompt,
    cost: cost,
    background_color: background_color,
    is_enabled: is_enabled,
    is_user_input_required: is_user_input_required,
    is_max_per_stream_enabled: is_max_per_stream_enabled,
    max_per_stream: max_per_stream,
    is_max_per_user_per_stream_enabled: is_max_per_user_per_stream_enabled,
    max_per_user_per_stream: max_per_user_per_stream,
    is_global_cooldown_enabled: is_global_cooldown_enabled,
    global_cooldown_seconds: global_cooldown_seconds
  }


    // Remove invalid fields based on Twitch rules 
  if (!is_max_per_stream_enabled) { 
    delete rewardToCreate.max_per_stream; 
  } 
  
  if (!is_max_per_user_per_stream_enabled) {
     delete rewardToCreate.max_per_user_per_stream; 
    } 
    
  if (!is_global_cooldown_enabled) { 
    delete rewardToCreate.global_cooldown_seconds; 
  } 
  
  // Remove any undefined/null fields Twitch doesn't want 
  Object.keys(rewardToCreate).forEach(key => { 
    if (rewardToCreate[key] === null || rewardToCreate[key] === undefined) { 
      delete rewardToCreate[key]; 
    } 
  });

    try {
    const data = await this._safeFetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${this.broadcaster_id}`,
      {
        method: "POST",
        headers: this._headers(),
        body: JSON.stringify(rewardToCreate),
      }
    );


  if (!data || data.error) {
    console.error("Reward creation failed:", data);
    return null;
  }
  const reward = data.data[0]


  let rewardSave = {id: reward.id, title: reward.title, prompt: reward.prompt, cost: reward.cost};

  

  //console.log(data)
  return rewardSave || null;

  } catch (error) {
    throw this._error("There was an error with creating the reward", error)
  }

};


async deleteCustomRewards(rewardId){
    const url = `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${this.broadcaster_id}&id=${rewardId}`;

    try {
        const data = await this._safeFetch(url, {
            method: "DELETE",
            headers: this._headers()
        });

        if(data && data.success){
            return true;
        };
    } catch (error) {
        throw this._error("There was an error deleting Custom Reward", error);
    }
};

async updateRedemptionStatus({redemptionId, rewardId, status = "FULFILLED"}){
    this._checkReady()
    if (!["FULFILLED", "CANCELED"].includes(status)) { status = "FULFILLED"; }
    const url = `https://api.twitch.tv/helix/channel_points/custom_rewards/redemptions?broadcaster_id=${this.broadcaster_id}&reward_id=${rewardId}&id=${redemptionId}`;

    try {
        const data = await this._safeFetch(url, {
        method: "PATCH",
        headers: this._headers(),
        body: JSON.stringify({status: status})
    });
    if (!data || data.error || !Array.isArray(data.data) || data.data.length === 0) { return {simplified: null, full: null }; }
    const entry = data.data[0];
    const reward = entry.reward;

    const summary = {
        redeemed_by: entry.user_name,
        user_id: entry.user_id,
        reward_id: reward.id,
        reward_title: reward.title,
        reward_cost: reward.cost,
        reward_status: entry.status,
        reward_redeemed_at: entry.redeemed_at
    };
    return {simplified: summary, full: entry}
    } catch (error) {
        throw this._error("There was an error with adjusting reward status", error)
    }
}


async cheerLeaderboard(){
    const url = `https://api.twitch.tv/helix/bits/leaderboard`;
    try {
        const data = await this._safeFetch(url, {
        method: "GET",
        headers: this._headers()
    });

if (!data || data.error || !Array.isArray(data.data)) { return []; }
    const array = [];

    for(const profile of data.data){
      const index = {
        userId: profile.user_id, 
        username: profile.user_login, 
        rank: profile.rank, 
        score: profile.score
      };
      
      array.push(index);
    }
    return array 

    } catch (error) {
    throw this._error("There was an error getting the cheer Leaderboard", error)
    }

}

};


module.exports = {Helix}
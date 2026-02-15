// top of file
const fs = require("fs");
const path = require("path");

let fetchFn = globalThis.fetch;
if (!fetchFn) {
  // for environments without global fetch (older Node), require node-fetch v2
  // ensure you install node-fetch@2 if you use this fallback
  fetchFn = require('node-fetch');
}




class Subscribe{
    constructor({clientId, token, broadcasterId = null, sessionId = null}){
        this.client_id = clientId;
        this.token = token;
        this.broadcaster_id = broadcasterId;
        this.session_id = sessionId;
        this._eventsub_url = "https://api.twitch.tv/helix/eventsub/subscriptions";

       
    }

_canStart() {
    const required = {
        client_id: this.client_id,
        token: this.token,
        broadcaster_id: this.broadcaster_id,
        session_id: this.session_id
    };

    for (const [key, value] of Object.entries(required)) {
        if (!value) {
            throw new Error(`${key} was not defined`);
        }
    }
}


    _error(message, error) {
    return new Error(`${message}: ${error?.message || error}`);
    }

    _headers() {
    return {
        "Client-ID": this.client_id,
        "Authorization": `Bearer ${this.token}`,
        "Content-Type": "application/json"
    }
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
        }

    
        async _safeFetch(url, options, timeoutMs = 5000){
            try {
                const result = await this._withTimeout(
                    async (signal) => {
                        const res = await fetchFn(url, {...options, signal});
    
                        if(res.status === 204) return {success: true, data: null}
                        const json = await res.json();
                        return {success: !json?.error, data: json }
                    },
                    timeoutMs
                );
                return result
            } catch (error) {
                console.error("Helix fetch failed:", url, error)
                return {success: false, error };
            }
        }

        async _safeSub(description, fn){
            try {
        const data = await fn();

        if (!data?.data || data.data.length === 0) {
            console.error(`❌ Subscription FAILED for ${description}:`, data);
            return false;
        }

        const sub = data.data[0];
        console.log(`✔ Subscription OK: ${sub.type} → ${sub.status}`);
        return true;

    } catch (err) {
        console.error(`❌ Subscription ERROR for ${description}:`, err);
        return false;
    }
        }

        async toFollows(){
            this._canStart();
           // try {
                return this._safeSub("Follow Event", async () => {
                    const url = this._eventsub_url;
        const body = {
            type: "channel.follow",
            version: "2",
            condition: {
                broadcaster_user_id: this.broadcaster_id,
                moderator_user_id: this.broadcaster_id
            },
            transport: {
                method: "websocket",
                session_id: this.session_id
            }
        }; 

            const data = await this._safeFetch(url, { 
                method: "POST", 
                headers: this._headers(), 
                body: JSON.stringify(body) 
            });

            return {success: !data?.error, data: data?.data}
                })

          //  } catch (error) {
            //    throw this._error("There was an error with subscribing to twitch follows", error)
           // }
        }


        async toRedemptions(){
            this._canStart();
          
                return this._safeSub("Redemption Event", async () => {
                                const url = this._eventsub_url;
            const body = {
                type: "channel.channel_points_custom_reward_redemption.add",
                version: "1",
                condition: {
                    broadcaster_user_id: this.broadcaster_id
                },
                transport: {
                    method: "websocket",
                    session_id: this.session_id
                }
            };

            const data = await this._safeFetch(url, {
                method: "POST",
                headers: this._headers(),
                body: JSON.stringify(body)
            });
            return {success: !data?.error, data: data}
                })
            }


        async toStreamOnline(){
            this._canStart();

                return this._safeSub("Stream Online Event", async () => {
                    const url = this._eventsub_url;
                const body = {
                    type: "stream.online",
                    version: "1",
                    condition: {
                        broadcaster_user_id: this.broadcaster_id
                    },
                    transport: {
                        method: "websocket",
                        session_id: this.session_id
                    }
                };

                return await this._safeFetch(url, {
                    method: "POST",
                    headers: this._headers(),
                    body: JSON.stringify(body)
                });
                })

        }


        async toStreamOffline(){
            this._canStart();

                return this._safeSub("Stream offline Event", async () => {
                    const url = this._eventsub_url;
                const body = {
                    type: "stream.offline",
                    version: "1",
                    condition: {
                        broadcaster_user_id: this.broadcaster_id,
                    },
                    transport: {
                        method: "websocket",
                        session_id: this.session_id
                    }
                };

                return await this._safeFetch(url, {
                    method: "POST",
                    headers: this._headers(),
                    body: JSON.stringify(body)
                });
                })
        }

        async toChannelUpdate(){
                this._canStart();
            const url = this._eventsub_url;
            
            return this._safeSub("Channell Update Event", async () => {
                    const body = {
            type: "channel.update",
            version: "2",
            condition: {
                broadcaster_user_id: this.broadcaster_id
            },
            transport: {
                method: "websocket",
                session_id: this.session_id
            }
            };

            return await this._safeFetch(url, {
                method: "POST",
                headers: this._headers(),
                body: JSON.stringify(body)
            });
                })


        }



        async toAll(){
            this._canStart();
           try {
            const [ 
                updates,
                follows, 
                redemptions, 
                online, 
                offline 
            ] = await Promise.all([ 
                this.toChannelUpdate(),
                this.toFollows(), 
                this.toRedemptions(), 
                this.toStreamOnline(), 
                this.toStreamOffline() 
            ]);

            return {
                channelUpdateData: updates,
                followsData: follows, 
                redemptionsData: redemptions, 
                isOnlineData: online, 
                isOfflineData: offline
            }
           } catch (error) {
            throw this._error("There was an error subscribing to all events", error)
           }
        }

}

module.exports = {Subscribe}
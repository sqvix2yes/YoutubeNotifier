const Discord = require("discord.js");
const Parser = require("rss-parser");
const Youtube = require("simple-youtube-api");
const config = require("./config.json"); // Déplacez cette ligne en haut

const parser = new Parser();
const youtube = new Youtube(config.youtubeKey);

const startAt = Date.now();
const lastVideos = {};

const client = new Discord.Client();

// Set initial status
client.once("ready", () => {
    console.log(`[!] Ready to listen ${config.youtubers.length} youtubers!`);
    check();
    setInterval(check, 20*1000);
    client.user.setActivity("Watching YouTube", { type: "WATCHING" }); // Set initial status
});

// Function to update status
function updateStatus(newStatus) {
    client.user.setActivity(newStatus, { type: "WATCHING" });
}

// Command to change status
client.on("message", (message) => {
    if (message.content.startsWith("!status")) {
        const newStatus = message.content.slice(8).trim();
        updateStatus(newStatus);
        message.channel.send("Status updated!");
    }
});

// Command to interact with me
client.on("message", (message) => {
    if (message.content.toLowerCase() === "hey assistant") {
        message.channel.send("Hey there! How can I assist you today?");
    }
});

client.login(config.token).catch(console.log);

async function getLastVideo(youtubeChannelName, rssURL){
    console.log(`[${youtubeChannelName}]  | Getting videos...`);
    let content = await parser.parseURL(rssURL);
    console.log(`[${youtubeChannelName}]  | ${content.items.length} videos found`);
    let tLastVideos = content.items.sort((a, b) => {
        let aPubDate = new Date(a.pubDate || 0).getTime();
        let bPubDate = new Date(b.pubDate || 0).getTime();
        return bPubDate - aPubDate;
    });
    console.log(`[${youtubeChannelName}]  | The last video is "${tLastVideos[0] ? tLastVideos[0].title : "err"}"`);
    return tLastVideos[0];
}

async function checkVideos(youtubeChannelName, rssURL){
    console.log(`[${youtubeChannelName}] | Get the last video..`);
    let lastVideo = await getLastVideo(youtubeChannelName, rssURL);
    if(!lastVideo) return console.log("[ERR] | No video found for "+lastVideo);
    if(new Date(lastVideo.pubDate).getTime() < startAt) return console.log(`[${youtubeChannelName}] | Last video was uploaded before the bot starts`);
    let lastSavedVideo = lastVideos[youtubeChannelName];
    if(lastSavedVideo && (lastSavedVideo.id === lastVideo.id)) return console.log(`[${youtubeChannelName}] | Last video is the same as the last saved`);
    return lastVideo;
}

function getYoutubeChannelIdFromURL(url) {
    let id = null;
    url = url.replace(/(>|<)/gi, "").split(/(\/channel\/|\/user\/)/);
    if(url[2]) {
      id = url[2].split(/[^0-9a-z_-]/i)[0];
    }
    return id;
}

async function getYoutubeChannelInfos(name){
    console.log(`[${name.length >= 10 ? name.slice(0, 10)+"..." : name}] | Resolving channel infos...`);
    let channel = null;
    let id = getYoutubeChannelIdFromURL(name);
    if(id){
        channel = await youtube.getChannelByID(id);
    }
    if(!channel){
        let channels = await youtube.searchChannels(name);
        if(channels.length > 0){
            channel = channels[0];
        }
    }
    console.log(`[${name.length >= 10 ? name.slice(0, 10)+"..." : name}] | Title of the resolved channel: ${channel.raw ? channel.raw.snippet.title : "err"}`);
    return channel;
}

async function check(){
    console.log("Checking...");
    config.youtubers.forEach(async (youtuber) => {
        console.log(`[${youtuber.length >= 10 ? youtuber.slice(0, 10)+"..." : youtuber}] | Start checking...`);
        let channelInfos = await getYoutubeChannelInfos(youtuber);
        if(!channelInfos) return console.log("[ERR] | Invalid youtuber provided: "+youtuber);
        let video = await checkVideos(channelInfos.raw.snippet.title, "https://www.youtube.com/feeds/videos.xml?channel_id="+channelInfos.id);
        if(!video) return console.log(`[${channelInfos.raw.snippet.title}] | No notification`);
        let channel = client.channels.cache.get(config.channel);
        if(!channel) return console.log("[ERR] | Channel not found");
        channel.send({ content: 
            config.message
            .replace("{videoURL}", video.link)
            .replace("{videoAuthorName}", video.author)
            .replace("{videoTitle}", video.title)
            .replace("{videoPubDate}", formatDate(new Date(video.pubDate)))
        });
        console.log("Notification sent !");
        lastVideos[channelInfos.raw.snippet.title] = video;
    });
}

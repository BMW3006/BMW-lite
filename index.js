const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const readline = require('readline');

// --- MAZINGIRA NA MIPANGILIO YA CHINI ---
const PREFIX = '.'; 
const BOT_NAME = 'BMW LITE';
const OWNER_NAME = 'RX';
const MENU_IMAGE = 'https://files.catbox.moe/7d9q28.jpg';
const CHANNEL_LINK = '\n\n*Join Our Channel:* https://whatsapp.com/channel/0029VbCjkJP2P59fBeYUuN1H';
const API_URL = 'https://api.giftedtech.co.ke';
const API_KEY = 'gifted'; // Badilisha na API key yako kama ipo

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Hatutaki QR Code
        auth: state
    });

    // Mfumo wa Pairing Code kama haujaunganishwa bado
    if (!sock.authState.creds.registered) {
        console.log("================================================");
        console.log(` Karibu kwenye ${BOT_NAME} - Iliyotengenezwa na ${OWNER_NAME}`);
        console.log("================================================");
        let phoneNumber = await question('Ingiza namba yako ya WhatsApp (Anza na 255...): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        console.log("\nInatengeneza Pairing Code... Tafadhali subiri.");
        await delay(3000);
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\nKODI YAKO NI: ${code}`);
        console.log("Weka kodi hii kwenye simu yako (Link with phone number)\n");
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Muunganisho umefungwa. Inajaribu kuwaka tena...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log(`\n[SUCCESS] ${BOT_NAME} Iko Online Sasa Hivi!`);
        }
    });

    // --- KUSIKILIZA MESEJI ZINAZOINGIA ---
    sock.ev.on('messages.upsert', async chat => {
        try {
            const msg = chat.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = isGroup ? msg.key.participant : from;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            
            if (!body.startsWith(PREFIX)) return;

            const args = body.slice(PREFIX.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const text = args.join(" ");

            // ==================== [ 1. AI MENU ] ====================
            if (command === 'gpt' || command === 'ai') {
                if (!text) return await sock.sendMessage(from, { text: `Tafadhali andika swali. Mfano: ${PREFIX}gpt mambo vipi?` }, { quoted: msg });
                await sock.sendMessage(from, { text: "Thinking... 🤖" }, { quoted: msg });
                try {
                    const res = await axios.get(`${API_URL}/api/ai/gpt4?apikey=${API_KEY}&q=${encodeURIComponent(text)}`);
                    await sock.sendMessage(from, { text: res.data.result + CHANNEL_LINK }, { quoted: msg });
                } catch {
                    await sock.sendMessage(from, { text: "Error: Imeshindikana kuwasiliana na AI." }, { quoted: msg });
                }
            }

            // ==================== [ 2. DOWNLOAD MENU ] ====================
            if (command === 'song' || command === 'play') {
                if (!text) return await sock.sendMessage(from, { text: `Andika jina la wimbo. Mfano: ${PREFIX}song Marioo Mi Amor` }, { quoted: msg });
                await sock.sendMessage(from, { text: "Downloading your song... 🎵" }, { quoted: msg });
                try {
                    const res = await axios.get(`${API_URL}/api/download/ytplay?apikey=${API_KEY}&query=${encodeURIComponent(text)}`);
                    const audioUrl = res.data.result.audio;
                    await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mp4' }, { quoted: msg });
                } catch {
                    await sock.sendMessage(from, { text: "Error: Wimbo haujapatikana." }, { quoted: msg });
                }
            }

            if (command === 'video') {
                if (!text) return await sock.sendMessage(from, { text: `Andika jina la video au link. Mfano: ${PREFIX}video Juma Jux` }, { quoted: msg });
                await sock.sendMessage(from, { text: "Downloading your video... 🎬" }, { quoted: msg });
                try {
                    const res = await axios.get(`${API_URL}/api/download/ytmp4?apikey=${API_KEY}&url=${encodeURIComponent(text)}`);
                    const videoUrl = res.data.result.video;
                    await sock.sendMessage(from, { video: { url: videoUrl }, caption: `${BOT_NAME}` + CHANNEL_LINK }, { quoted: msg });
                } catch {
                    await sock.sendMessage(from, { text: "Error: Video haijapatikana." }, { quoted: msg });
                }
            }

            // ==================== [ 3. GROUP MENU ] ====================
            if (command === 'kick') {
                if (!isGroup) return await sock.sendMessage(from, { text: "Hii command ni ya kwenye magroup tu!" }, { quoted: msg });
                const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                if (!mentioned) return await sock.sendMessage(from, { text: "Mtag mtu unayetaka kumtoa!" }, { quoted: msg });
                await sock.groupParticipantsUpdate(from, [mentioned], "remove");
                await sock.sendMessage(from, { text: "Mwanachama ametolewa! ❌" + CHANNEL_LINK }, { quoted: msg });
            }

            if (command === 'add') {
                if (!isGroup) return await sock.sendMessage(from, { text: "Hii command ni ya kwenye magroup tu!" }, { quoted: msg });
                if (!text) return await sock.sendMessage(from, { text: "Weka namba ya kuongeza (iliyomwambatanisha na country code)." }, { quoted: msg });
                const formattedNum = text.includes('@s.whatsapp.net') ? text : `${text}@s.whatsapp.net`;
                await sock.groupParticipantsUpdate(from, [formattedNum], "add");
                await sock.sendMessage(from, { text: "Mwanachama ameongezwa! ✅" + CHANNEL_LINK }, { quoted: msg });
            }

            // ==================== [ 4. GROUP STATUS (KIBIASHARA) ] ====================
            if (command === 'tosgroup' || command === 'groupstatus') {
                let statusMsg = `*─── [ ${BOT_NAME} GROUP STATUS ] ───*\n\n`;
                statusMsg += `Weka matangazo au 'Stories' zako hapa kwenye kundi zionekane na kila mtu!\n\n`;
                statusMsg += `*VIGEZO NA BEI:* \n`;
                statusMsg += `• Saa 1  -> Tsh 500\n`;
                statusMsg += `• Masaa 6 -> Tsh 1,500\n`;
                statusMsg += `• Masaa 12 -> Tsh 2,500\n`;
                statusMsg += `• Masaa 24 -> Tsh 4,000\n\n`;
                statusMsg += `_Kama unataka kuweka tangazo lako sasa hivi, wasiliana na Admin au tumia command ya malipo._`;
                statusMsg += CHANNEL_LINK;

                await sock.sendMessage(from, { text: statusMsg }, { quoted: msg });
            }

            // ==================== [ 5. MAIN MENU ] ====================
            if (command === 'menu' || command === 'help') {
                let menuText = `┏▣ ◈ *${BOT_NAME}* ◈\n`;
                menuText += `┃ *ᴏᴡɴᴇʀ* : ${OWNER_NAME}\n`;
                menuText += `┃ *ᴘʀᴇғɪx* : [ ${PREFIX} ]\n`;
                menuText += `┃ *ᴍᴏᴅᴇ* : Public\n`;
                menuText += `┃ *ᴠᴇʀsɪᴏɴ* : 1.9.4\n`;
                menuText += `┃ *sᴘᴇᴇᴅ* : 0.35 ms\n`;
                menuText += `┃ *ᴜsᴀɢᴇ* : 100 MB of 31 GB\n`;
                menuText += `┗▣\n\n`;
                
                menuText += `*─── [ AI MENU ] ───*\n`;
                menuText += `» ${PREFIX}gpt [swali]\n» ${PREFIX}ai [swali]\n\n`;
                
                menuText += `*─── [ DOWNLOAD MENU ] ───*\n`;
                menuText += `» ${PREFIX}song [jina]\n» ${PREFIX}video [jina/link]\n» ${PREFIX}apk [app name]\n\n`;
                
                menuText += `*─── [ GROUP MENU ] ───*\n`;
                menuText += `» ${PREFIX}kick [@tag]\n» ${PREFIX}add [namba]\n» ${PREFIX}groupstatus\n» ${PREFIX}tosgroup\n\n`;
                
                menuText += `*─── [ FUN & TOOLS ] ───*\n`;
                menuText += `» ${PREFIX}joke\n» ${PREFIX}qrcode [text]\n`;
                
                menuText += CHANNEL_LINK;

                // Kutuma menu ikiwa na picha juu yake
                await sock.sendMessage(from, { 
                    image: { url: MENU_IMAGE }, 
                    caption: menuText 
                }, { quoted: msg });
            }

        } catch (err) {
            console.log("Kosa limetokea: ", err);
        }
    });
}

startBot();

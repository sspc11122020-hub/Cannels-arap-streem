const fs = require('fs');
const path = require('path');
const axios = require('axios');

// قائمة الروابط المستخرجة من الموقع
const sourceUrls = [
    "https://daddylive.mov/cache/channels.json?v=1785871295137&r=0.817095409251016",
    "https://daddylive.mov/player/player5.json?v=1785871295137",
    "https://daddylive.mov/player/player10.json?v=1785871295137",
    "https://daddylive.mov/player/player14.json?v=1785871295138",
    "https://daddylive.mov/player/player6.json?v=1785871295138",
    "https://daddylive.mov/player/player2.json?v=1785871295139",
    "https://daddylive.mov/player/player9.json?v=1785871295139",
    "https://daddylive.mov/player/player11.json?v=1785871295139"
];

// دالة ذكية جداً للتحقق مما إذا كانت القناة عربية أم لا
function isArabicChannel(name) {
    if (!name) return false;
    const lower = name.toLowerCase();

    // قائمة الكلمات الدالة على القنوات العربية أو تصنيفاتها
    const arabicKeywords = [
        'arabic', ' ar ', 'ar/', '(ar)', 'beinsports', 'bein sport', 
        'mbc', 'ssc', 'rotana', 'alkass', 'kass', 'abu dhabi sports', 
        'dubai sports', 'sharjah', 'iraqiya', 'thmanyah', 'al arabia', 
        'aljazeera', 'syria', 'jordan', 'egypt', 'tunisia', 'morocco', 
        'algérie', 'lebanon', 'palestine', 'sudan', 'oman', 'kuwait', 
        'qatar', 'bahrain', 'saudi'
    ];

    // التحقق إذا كان الاسم يبدأ أو ينتهي أو يحتوي على كلمة دالة
    return arabicKeywords.some(keyword => lower.includes(keyword)) || /\bar\b/.test(lower);
}

async function scrapeChannels() {
    let allProcessedChannels = [];

    for (const url of sourceUrls) {
        try {
            console.log(`جاري جلب البيانات من: ${url}`);
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;

            if (Array.isArray(data)) {
                data.forEach(item => {
                    const channelName = item.title || item.name;
                    if (!channelName || channelName.includes("Channel not listed")) return;

                    let servers = [];

                    // التعامل مع الروابط المفردة
                    if (item.url) {
                        servers.push({ name: "Main Server", link: item.url });
                    }

                    // التعامل مع السيرفرات المتعددة (url1, url2, url3...)
                    Object.keys(item).forEach(key => {
                        if (key.startsWith('url') && item[key]) {
                            servers.push({ name: key.toUpperCase(), link: item[key] });
                        }
                    });

                    allProcessedChannels.push({
                        id: item.id || null,
                        name: channelName.trim(),
                        servers: servers
                    });
                });
            }
        } catch (error) {
            console.error(`خطأ في جلب الرابط ${url}:`, error.message);
        }
    }

    // إزالة القنوات المكررة بناءً على الاسم
    const uniqueChannels = Array.from(new Map(allProcessedChannels.map(c => [c.name, c])).values());

    console.log(`إجمالي القنوات الفريدة المستخرجة: ${uniqueChannels.length}. جاري الفرز والحفظ...`);

    // تقسيم القنوات إلى قسمين أساسيين: عربية وعالمية
    const arabicChannels = [];
    const globalChannels = [];

    uniqueChannels.forEach(channel => {
        if (isArabicChannel(channel.name)) {
            arabicChannels.push(channel);
        } else {
            globalChannels.push(channel);
        }
    });

    // ترتيب القنوات أبجدياً لسهولة التصفح
    arabicChannels.sort((a, b) => a.name.localeCompare(b.name));
    globalChannels.sort((a, b) => a.name.localeCompare(b.name));

    // حفظ القنوات العربية في مجلد Arabic
    const arabicDir = path.join(__dirname, 'Arabic');
    if (!fs.existsSync(arabicDir)) {
        fs.mkdirSync(arabicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(arabicDir, 'channels.json'), JSON.stringify(arabicChannels, null, 4), 'utf-8');
    console.log(`تم حفظ ${arabicChannels.length} قناة عربية في مجلد Arabic/channels.json`);

    // حفظ باقي القنوات في مجلد Global
    const globalDir = path.join(__dirname, 'Global');
    if (!fs.existsSync(globalDir)) {
        fs.mkdirSync(globalDir, { recursive: true });
    }
    fs.writeFileSync(path.join(globalDir, 'channels.json'), JSON.stringify(globalChannels, null, 4), 'utf-8');
    console.log(`تم حفظ ${globalChannels.length} قناة عالمية في مجلد Global/channels.json`);

    console.log("اكتملت عملية الفرز والحفظ بنجاح!");
}

scrapeChannels();

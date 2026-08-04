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

// دالة ذكية للتحقق مما إذا كانت القناة عربية أم لا (إذا أردت استخدامها لاحقاً، حالياً الكود يجمع الكل ويرتبهم بالحروف)
function isArabicChannel(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    const arabicKeywords = [
        'arabic', ' ar ', 'ar/', '(ar)', 'beinsports', 'bein sport', 
        'mbc', 'ssc', 'rotana', 'alkass', 'kass', 'abu dhabi sports', 
        'dubai sports', 'sharjah', 'iraqiya', 'thmanyah', 'al arabia', 
        'aljazeera', 'syria', 'jordan', 'egypt', 'tunisia', 'morocco', 
        'algérie', 'lebanon', 'palestine', 'sudan', 'oman', 'kuwait', 
        'qatar', 'bahrain', 'saudi'
    ];
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

    console.log(`إجمالي القنوات الفريدة المستخرجة: ${uniqueChannels.length}. جاري الفرز حسب الحرف والحفظ...`);

    // إنشاء مسار المجلد الرئيسي chann
    const mainDir = path.join(__dirname, 'chann');
    if (!fs.existsSync(mainDir)) {
        fs.mkdirSync(mainDir, { recursive: true });
    }

    // كائن لتخزين وتجميع القنوات حسب الحرف الأول
    const channelsByLetter = {};

    uniqueChannels.forEach(channel => {
        const firstLetter = channel.name.trim().charAt(0).toUpperCase();
        
        // تحديد اسم الملف بناءً على الحرف (إذا كان رقم أو رمز يوضع في ملف 0-9)
        let fileName;
        if (/^[A-Z]$/.test(firstLetter)) {
            fileName = `${firstLetter}.json`;
        } else {
            fileName = `0-9.json`; // للأرقام أو الرموز الخاصة
        }

        if (!channelsByLetter[fileName]) {
            channelsByLetter[fileName] = [];
        }
        channelsByLetter[fileName].push(channel);
    });

    // حفظ كل مجموعة حروف في ملفها الخاص داخل مجلد chann
    for (const [fileName, channels] of Object.entries(channelsByLetter)) {
        // ترتيب القنوات أبجدياً داخل الملف الواحد
        channels.sort((a, b) => a.name.localeCompare(b.name));

        const filePath = path.join(mainDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(channels, null, 4), 'utf-8');
        console.log(`تم حفظ ${channels.length} قناة في الملف: chann/${fileName}`);
    }

    console.log("اكتملت عملية الترتيب والحفظ حسب الأحرف بنجاح!");
}

scrapeChannels();

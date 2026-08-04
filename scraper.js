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

// دالة للحصول على الحرف الأول من اسم القناة (مع تجاهل الأرقام والرموز الخاصة)
function getFirstLetter(name) {
    if (!name) return '#';
    
    // إزالة المسافات في البداية والنهاية
    const trimmed = name.trim();
    
    // إذا كان الاسم فارغاً بعد التنظيف
    if (trimmed.length === 0) return '#';
    
    // الحصول على أول حرف
    const firstChar = trimmed.charAt(0).toUpperCase();
    
    // التحقق إذا كان حرفاً إنجليزياً
    if (/[A-Z]/.test(firstChar)) {
        return firstChar;
    }
    
    // إذا كان رقماً أو رمزاً خاصاً
    return '#';
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

    // تقسيم القنوات حسب الحرف الأول
    const channelsByLetter = {};
    
    uniqueChannels.forEach(channel => {
        const firstLetter = getFirstLetter(channel.name);
        
        if (!channelsByLetter[firstLetter]) {
            channelsByLetter[firstLetter] = [];
        }
        
        channelsByLetter[firstLetter].push(channel);
    });

    // ترتيب القنوات داخل كل مجموعة أبجدياً
    Object.keys(channelsByLetter).forEach(letter => {
        channelsByLetter[letter].sort((a, b) => a.name.localeCompare(b.name));
    });

    // إنشاء مجلد /chann/ الرئيسي
    const mainDir = path.join(__dirname, 'chann');
    if (!fs.existsSync(mainDir)) {
        fs.mkdirSync(mainDir, { recursive: true });
    }

    // حفظ كل مجموعة في ملف منفصل
    let totalSaved = 0;
    const letters = Object.keys(channelsByLetter).sort();
    
    for (const letter of letters) {
        const channels = channelsByLetter[letter];
        const fileName = `${letter}.json`;
        const filePath = path.join(mainDir, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(channels, null, 4), 'utf-8');
        console.log(`تم حفظ ${channels.length} قناة في ملف ${fileName}`);
        totalSaved += channels.length;
    }

    // إنشاء ملف فهرس (index) يحتوي على جميع القنوات مع معلومات الحرف
    const indexData = {};
    for (const letter of letters) {
        indexData[letter] = {
            count: channelsByLetter[letter].length,
            file: `${letter}.json`,
            channels: channelsByLetter[letter].map(c => c.name) // قائمة بأسماء القنوات فقط للتصفح السريع
        };
    }
    
    fs.writeFileSync(
        path.join(mainDir, 'index.json'), 
        JSON.stringify(indexData, null, 4), 
        'utf-8'
    );
    
    console.log(`\nتم حفظ الفهرس العام في chann/index.json`);
    console.log(`تم حفظ إجمالي ${totalSaved} قناة في ${letters.length} ملف داخل مجلد /chann/`);
    console.log("اكتملت عملية الفرز والحفظ بنجاح!");
}

scrapeChannels();

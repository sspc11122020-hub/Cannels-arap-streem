const fs = require('fs');
const path = require('path');
const axios = require('axios');

// قائمة الروابط التي استخرجتها من الموقع
const sourceUrls = [
    "https://daddylive.mov/cache/channels.json?v=1785871295137&r=0.817095409251016",
    "https://daddylive.mov/player/player5.json?v=1785871295137",
    "https://daddylive.mov/player/player10.json?v=1785871295137",
    "https://daddylive.mov/player/player14.json?v=1785871295138",
    "https://daddylive.mov/player/player6.json?v=1785871295138",
    "https://daddylive.mov/player/player2.json?v=1785871295139",
    "https://daddylive.mov/player/player9.json?v=1785871295139",
    "https://daddylive.mov/player/player11.json?v=1785871295139"
    // يمكنك إضافة أي روابط أخرى هنا نفس النمط
];

// دالة ذكية لتصنيف القناة وتحديد مجلدها وملفها بناءً على اسمها
function classifyChannel(name) {
    if (!name) return { folder: 'Global', file: 'general.json' };
    
    const lower = name.toLowerCase();
    
    // فحص القنوات العربية والمجموعات الرياضية/الترفيهية الشهيرة
    if (lower.includes('bein')) return { folder: 'Arabic', file: 'bein.json' };
    if (lower.includes('mbc')) return { folder: 'Arabic', file: 'mbc.json' };
    if (lower.includes('ssc')) return { folder: 'Arabic', file: 'ssc.json' };
    if (lower.includes('rotana')) return { folder: 'Arabic', file: 'rotana.json' };
    if (lower.includes('alkass') || lower.includes('kass') || lower.includes('abu dhabi sports')) return { folder: 'Arabic', file: 'sports_ar.json' };
    
    // إذا كانت القناة عربية أو تحتوي على كلمات دالة
    if (lower.includes('arabic') || lower.includes('ar ') || lower.includes('iraqiya') || lower.includes('thmanyah')) {
        return { folder: 'Arabic', file: 'others.json' };
    }

    // تصنيفات عامة لباقي دول العالم
    if (lower.includes('sport') || lower.includes('espn') || lower.includes('tnt sports') || lower.includes('arena sport')) {
        return { folder: 'Global', file: 'sports.json' };
    }

    return { folder: 'Global', file: 'general.json' };
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
                    // توحيد الهياكل المختلفة (سواء كانت title أو name أو تحتوي على url أو url1, url2...)
                    const channelName = item.title || item.name;
                    if (!channelName || channelName.includes("Channel not listed")) return;

                    let servers = [];

                    // التعامل مع الروابط المفردة
                    if (item.url) {
                        servers.push({ name: "Main Server", link: item.url });
                    }

                    // التعامل مع الروابط المتعددة مثل url1, url2, url3
                    Object.keys(item).forEach(key => {
                        if (key.startsWith('url') && item[key]) {
                            servers.push({ name: key.toUpperCase(), link: item[key] });
                        }
                    });

                    allProcessedChannels.push({
                        id: item.id || null,
                        name: channelName,
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

    console.log(`تم معالجة وإجمالي القنوات الفريدة: ${uniqueChannels.length}. جاري الترتيب والحفظ...`);

    // هيكل لتخزين الملفات وترتيبها
    const fileStorage = {};

    uniqueChannels.forEach(channel => {
        const classification = classifyChannel(channel.name);
        const dirPath = path.join(__dirname, classification.folder);
        const filePath = path.join(dirPath, classification.file);

        if (!fileStorage[filePath]) {
            fileStorage[filePath] = {
                dir: dirPath,
                channels: []
            };
        }
        fileStorage[filePath].channels.push(channel);
    });

    // الكتابة الفعلية للملفات في المجلدات
    for (const [filePath, content] of Object.entries(fileStorage)) {
        if (!fs.existsSync(content.dir)) {
            fs.mkdirSync(content.dir, { recursive: true });
        }
        
        // ترتيب القنوات أبجدياً داخل الملف لضمان التنظيم
        content.channels.sort((a, b) => a.name.localeCompare(b.name));

        fs.writeFileSync(filePath, JSON.stringify(content.channels, null, 4), 'utf-8');
        console.log(`تم حفظ ${content.channels.channels?.length || content.channels.length} قناة في: ${filePath}`);
    }

    console.log("تم الانتهاء من ترتيب وتصنيف جميع القنوات بنجاح!");
}

scrapeChannels();

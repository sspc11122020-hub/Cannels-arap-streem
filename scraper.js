const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// دالة لتصنيف القنوات بذكاء
function categorizeChannel(name) {
    const lowerName = name.toLowerCase();
    
    // فحص القنوات العربية والمجموعات
    if (lowerName.includes('bein')) return { folder: 'Arabic', file: 'bein.json' };
    if (lowerName.includes('mbc')) return { folder: 'Arabic', file: 'mbc.json' };
    if (lowerName.includes('ssc')) return { folder: 'Arabic', file: 'ssc.json' };
    if (lowerName.includes('rotana')) return { folder: 'Arabic', file: 'rotana.json' };
    if (lowerName.includes('alkass') || lowerName.includes('kass')) return { folder: 'Arabic', file: 'alkass.json' };
    
    // فحص إذا كانت القناة تحتوي على Arabic أو ar
    if (lowerName.includes('arabic') || lowerName.match(/\bar\b/)) {
        return { folder: 'Arabic', file: 'others.json' };
    }

    // القنوات الأجنبية أو الأخرى
    return { folder: 'Global', file: 'general.json' };
}

(async () => {
    // تشغيل المتصفح بوضع Headless المُحسّن
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();

    // تحسين الأداء: منع تحميل الصور وملفات الـ CSS لتسريع الاستخراج
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    console.log("جاري جلب قائمة القنوات الرئيسية...");
    await page.goto('https://daddylive.mov/channel', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // استخراج أسماء وروابط القنوات من الـ grid-item
    const channels = await page.$$eval('.grid-item', elements => {
        return elements.map(el => {
            const aTag = el.querySelector('a');
            return {
                name: aTag ? aTag.innerText.trim() : el.getAttribute('data-channel-name'),
                url: aTag ? aTag.href : null
            };
        }).filter(c => c.url !== null);
    });

    console.log(`تم العثور على ${channels.length} قناة. جاري الفحص والتصنيف...`);

    const groupedData = {};

    // فلترة القنوات العربية فقط لتسريع العملية (يمكنك إزالة هذا الشرط لجلب كل قنوات العالم)
    const targetChannels = channels.filter(c => categorizeChannel(c.name).folder === 'Arabic');

    for (let i = 0; i < targetChannels.length; i++) {
        const channel = targetChannels[i];
        const category = categorizeChannel(channel.name);
        
        console.log(`[${i + 1}/${targetChannels.length}] استخراج سيرفرات قناة: ${channel.name}`);
        
        const channelPage = await browser.newPage();
        
        // تطبيق نفس تحسينات الأداء على صفحة القناة
        await channelPage.setRequestInterception(true);
        channelPage.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        try {
            await channelPage.goto(channel.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // استخراج أزرار السيرفرات (Link - 1, Link - 2, إلخ)
            const servers = await channelPage.$$eval('a', links => {
                return links
                    .filter(link => link.innerText.includes('Link -') || link.innerText.includes('Server'))
                    .map(link => ({
                        serverName: link.innerText.trim(),
                        serverUrl: link.href
                    }));
            });

            channel.servers = servers;

            // تنظيم البيانات في المجلدات والملفات
            const dirPath = path.join(__dirname, category.folder);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            const filePath = path.join(dirPath, category.file);
            if (!groupedData[filePath]) groupedData[filePath] = [];
            groupedData[filePath].push(channel);

        } catch (error) {
            console.error(`حدث خطأ أثناء فحص قناة ${channel.name}:`, error.message);
        } finally {
            await channelPage.close();
        }
    }

    // حفظ البيانات في ملفات JSON بشكل آلي ومنسق
    for (const [filePath, data] of Object.entries(groupedData)) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
        console.log(`تم حفظ ${data.length} قناة في: ${filePath}`);
    }

    await browser.close();
    console.log("اكتملت العملية بنجاح!");
})();

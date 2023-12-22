const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

const messages = [];

io.on('connection', (socket) => {
  console.log('A user connected');

  // ส่งข้อความมายัง client เมื่อเชื่อมต่อ
  socket.emit('messages', messages);

  // รับข้อมูลจาก client
  socket.on('redeemablePoints', (data) => {
    // นำข้อมูลไปใช้ต่อตรงนี้ตามที่คุณต้องการ
    console.log(`Redeemable Points for "${data.msg}": ${data.redeemablePoints}`);
  });

  // จบการเชื่อมต่อ
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

app.get('/messages', (req, res) => {
  res.json(messages);
});

app.post('/addMessage', async (req, res) => {
  const { text } = req.body;

  if (text) {
    const messagesArray = text.split('\n');
    const nonEmptyMessages = messagesArray.filter(msg => msg.trim() !== '');

    

    // ใช้ Promise.all() เพื่อดึงข้อมูล redeemablePoints ทุกข้อความแบบ parallel
    await Promise.all(nonEmptyMessages.map(async (msg) => {
      // เพิ่มข้อความใหม่ลงใน array
      messages.push(msg);

      // ดึงค่า redeemable_points สำหรับแต่ละ message
      const fetchConfig = {
        json: true,
        code: 'uspts.worlds',
        scope: 'uspts.worlds',
        table: 'userpoints',
        lower_bound: msg,
        upper_bound: msg,
        index_position: 1,
        key_type: '',
        limit: 1,
        reverse: false,
        show_payer: false,
      };

      const axiosConfig = {
        method: 'POST',
        url: 'https://wax.greymass.com/v1/chain/get_table_rows',
        headers: {},
        data: fetchConfig,
      };

      try {
        const response = await axios(axiosConfig);
        const redeemablePoints = parseFloat(response.data.rows[0].redeemable_points)/10;

        console.log(`Redeemable Points for "${msg}": ${redeemablePoints}`);

        // ส่งค่า redeemablePoints กลับไปยังหน้าเว็บ
        io.emit('redeemablePoints', { msg, redeemablePoints });
      } catch (error) {
        console.error(`Error fetching redeemable points for "${msg}":`, error.message);
      }
    }));
    // ล้าง array ข้อความเดิม
    messages.length = 0;
    res.send('เพิ่มข้อความเรียบร้อย');
  } else {
    res.status(400).send('กรุณาใส่ข้อความ');
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

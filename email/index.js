const nodemailer = require("nodemailer");

// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
  host: "smtp.163.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: 'zhy18251893098@163.com', // generated ethereal user
    pass: '654321ww' // generated ethereal password
  }
});

module.exports = (to,verifyCode) => {
  console.log(to);
  // async..await is not allowed in global scope, must use a wrapper
  async function main() {
    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: '"vrain" <zhy18251893098@163.com>', // sender address
      to, // list of receivers
      subject: "欢迎注册vrain！", // Subject line
      html: `<b>您的验证码是${verifyCode}</b>` // html body
    });

  }

  main().catch((err)=>{
    console.log(err);
  });
}
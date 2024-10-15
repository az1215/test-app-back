const express = require('express');
const app = express();
app.use(express.json()) //jsonのリクエスト/レスポンスを正しく受け取る為に必要

const info = app.get('/info', (req, res) => {
    res.json({message: "お知らせはありません。"});
  });

module.exports = info;
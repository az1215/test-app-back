const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require("bcrypt");
const cors = require('cors');
const app = express();
const path = require('path');

// CORS設定。異なるURLからでも呼び出せるようにする
app.use(function(req, res, next) {
   res.header("Access-Control-Allow-Origin", "*");
   res.header(
     "Access-Control-Allow-Headers",
     "Origin, X-Requested-With, Content-Type, Accept"
   );
   next();
 });

 // jsonを使えるようにする
 app.use(express.json());
 // corsを有効にする
 app.use(cors()) 

 //mysqlと接続するための設定
 const con = mysql.createConnection({
   host: 'localhost',
   user: 'root',
   password: 'password',
   database: 'test'
 });
 // 他のファイルでmysqlを使えるようにexport
 module.exports = con
 
 // Fetch API設定
 const jsonParser = bodyParser.json();

// サーバ起動
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Listening on port ${port}...`));




/**
 * ログイン画面関連
 */
// ユーザー情報取得
app.post('/getUserInfo', jsonParser, (req, res) => {
  const { user, pass } = req.body;
  let sql = '';
  sql += '     SELECT A.USER_ID, LAST_NAME_KANJI, FIRST_NAME_KANJI, SYS_USE_START_YEAR, SYS_USE_START_MONTH, ATND_REGIST, ATND_APPROVAL, ADMIN_AUTH, PASSWORD, INIT_FLG';
  sql += '       FROM EMP_MST A';
  sql += ' INNER JOIN LOGIN_INFO B ON A.USER_ID = B.USER_ID';
  sql += ' INNER JOIN AUTH_MST C ON A.USER_ID = C.USER_ID';
  sql += '      WHERE A.USER_ID = ?';
  con.execute(sql, [user], (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    if(result.length === 0) {
      return res.json({
        result: false
      });
    } 
    const hashedPassword = result[0].PASSWORD.trim();
    bcrypt.compare(pass, hashedPassword)
    .then(isMatch => {
      if (isMatch) {
        // 入力されたパスワードがDBのハッシュ化されたパスワードと一致する
        return res.json({
          result: true,
          userId: result[0].USER_ID,
          lastName: result[0].LAST_NAME_KANJI,
          firstName: result[0].FIRST_NAME_KANJI,
          sysUseStartYear: result[0].SYS_USE_START_YEAR,
          sysUseStartMonth: result[0].SYS_USE_START_MONTH,
          atndRegist: result[0].ATND_REGIST === '1' ? true : false,
          atndApproval: result[0].ATND_APPROVAL === '1' ? true : false,
          adminAnth: result[0].ADMIN_AUTH === '1' ? true : false,
          initFlg: result[0].INIT_FLG === '1' ? true : false,
        });
      } else {
        return res.json({
          result: false
        });
      }
    })
  })
  
})

// ログイン情報保存
app.post('/saveLoginInfo', jsonParser, (req, res) => {
  const { user,pass } = req.body;

  // パスワード生成
  const str = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let password = "";
  for (let i = 0; i < 8; i++) {
    let selected = Math.floor(Math.random() * str.length);
    password += str.substring(selected, selected + 1);
  }
  
  bcrypt.hash(pass, 10).then(hash => {
    let sql = '';
    sql += 'INSERT LOGIN_INFO (USER_ID, PASSWORD)';
    sql += '          VALUES (?, ?)';
    // パスワード暗号化
    con.query(sql, [user, hash], (err, result) => {
      // エラーが発生した場合はエラーメッセージを返す
      if(err) {
        return res.status(400).json({"error": err.message})
      }
      return res.json({"result": 0})
    })
  });
 
})

// パスワード変更
app.post('/updatePassword', jsonParser, (req, res) => {
  const { user,pass } = req.body;
  bcrypt.hash(pass, 10).then(hash => {
    let sql = '';
    sql += 'UPDATE LOGIN_INFO SET PASSWORD = ? , INIT_FLG = "0"';
    sql += ' WHERE USER_ID = ?';
    // パスワード暗号化
    con.query(sql, [hash, user], (err, result) => {
      // エラーが発生した場合はエラーメッセージを返す
      if(err) {
        return res.status(400).json({"error": err.message})
      }
      return res.json({
        result: true
      });
    })
  });
})


/**
 * 勤怠画面関連
 */
// 勤怠データ取得
app.post('/getAtndData', jsonParser, (req, res) => {
  const { user, year, month } = req.body;
  let sql = '';
  sql += 'SELECT ATTENDANCE_DATA, APPROVAL_CLS';
  sql += '  FROM WORK_INFO';
  sql += ' WHERE USER_ID = ?';
  sql += '   AND YEAR = ?';
  sql += '   AND MONTH = ?';
  con.execute(sql, [user,year,month], (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    // エラーが発生しなかった場合はsql文で取得したデータを返す
    if(result.length === 0) {
      res.json({
        isApproved: false,
        isRegistered: false,
        data: []
      });
    } else {
      let approvalCls = result[0].APPROVAL_CLS
      res.json({
        isApproved: approvalCls === '2' ||  approvalCls === '4' ? true :false,
        isRegistered: true,
        data: JSON.parse(JSON.stringify(result[0].ATTENDANCE_DATA))
      });
    }
  })
  
})

// 勤怠データ保存
app.post('/saveAtndData', jsonParser, (req, res) => {
  const { user, year, month ,data,isRegistered} = req.body;
  let sql = '';
  let param = []
  if(isRegistered) {
    sql += 'UPDATE WORK_INFO SET ATTENDANCE_DATA = ?';
    sql += ' WHERE USER_ID = ?';
    sql += '   AND YEAR = ?';
    sql += '   AND MONTH = ?';
    param = [data, user, year, month];
  } else {
    sql += 'INSERT WORK_INFO (USER_ID, YEAR, MONTH, ATTENDANCE_DATA)';
    sql += '          VALUES (?, ?, ?, ?)';
    param = [user, year, month, data];
  }

  con.query(sql, param, (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    return res.json({"result": 0})
  })
  
})

// 管理者用勤怠データ取得取得
app.post('/getForAdminAtndData', jsonParser, (req, res) => {
  const { user, year, month } = req.body;
  let sql = '';
  let param = []

  sql += ' SELECT * FROM ( ';
  sql += '  SELECT DISTINCT(A.USER_ID), A.LAST_NAME_KANJI, A.FIRST_NAME_KANJI, C.ATTENDANCE_DATA , C.APPROVAL_CLS, B.PROJECT_NAME, B.TIME_FRAME_FROM, B.TIME_FRAME_TO,';
  sql += '          CASE WHEN CONCAT(?, ?) >= CONCAT(A.SYS_USE_START_YEAR,A.SYS_USE_START_MONTH) ';
  sql += '               THEN  CONCAT(?, ?) ';
  sql += '               ELSE NULL';
  sql += '                END AS DISP_DATE';
  sql += '       FROM EMP_MST A';
  sql += ' INNER JOIN CONTRACT_INFO_MST B ON A.USER_ID = B.USER_ID';
  sql += '  LEFT JOIN WORK_INFO C ON A.USER_ID = C.USER_ID AND C.YEAR = ? AND C.MONTH = ?';
  sql += '      WHERE (C.APPROVAL_USER_ID = ? OR C.APPROVAL_USER_ID IS NULL)';
  sql += '        AND CONCAT(?, ?) >= CONCAT(B.PROJECT_START_YEAR,B.PROJECT_START_MONTH) ';
  sql += '        AND CONCAT(?, ?) <= CONCAT(IFNULL(B.PROJECT_END_YEAR,?),IFNULL(B.PROJECT_END_MONTH,?) )';
  sql += ' )  D';
  sql += ' WHERE DISP_DATE IS NOT NULL';
  param = [year, month, year, month, year, month, user, year, month, year, month, year, month];
  con.query(sql, param, (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    // エラーが発生しなかった場合はsql文で取得したデータを返す
    if(result.length === 0) {
      res.json({});
    } else {
      let data = []
      for(let i = 0; i < result.length; i++){
        data.push({
          userId: result[i].USER_ID,
          userName: result[i].LAST_NAME_KANJI + " " + result[i].FIRST_NAME_KANJI,
          approvalCls: result[i].APPROVAL_CLS,
          data: JSON.parse(JSON.stringify(result[i].ATTENDANCE_DATA)),
          projectName: result[i].PROJECT_NAME,
          timeFrameFrom: result[i].TIME_FRAME_FROM,
          timeFrameTo: result[i].TIME_FRAME_TO,
        })
      }
      res.json(data);
    }
  })
  
})

// 承認済み勤怠データ取得
app.post('/getApprovalAtndData', jsonParser, (req, res) => {
  const { year, month } = req.body;
  let sql = '';
  let param = []
  sql += '     SELECT A.USER_ID, B.LAST_NAME_KANJI, B.FIRST_NAME_KANJI, A.ATTENDANCE_DATA';
  sql += '       FROM WORK_INFO A';
  sql += ' INNER JOIN EMP_MST B ON A.USER_ID = B.USER_ID';
  sql += '      WHERE A.APPROVAL_CLS = "4" ';
  sql += '        AND A.YEAR = ? ';
  sql += '        AND A.MONTH = ? ';
  sql += '   ORDER BY A.USER_ID';
  param = [year, month];
  con.query(sql, param, (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    // エラーが発生しなかった場合はsql文で取得したデータを返す
    if(result.length === 0) {
      res.json({});
    } else {
      let data = []
      for(let i = 0; i < result.length; i++){
        data.push({
          userName: result[i].LAST_NAME_KANJI + " " + result[0].FIRST_NAME_KANJI,
          userId: result[i].USER_ID,
          data: JSON.parse(JSON.stringify(result[i].ATTENDANCE_DATA))
        })
      }
      res.json(data);
    }
  })
})

// 勤怠承認・差戻
app.post('/approvalAtndData', jsonParser, (req, res) => {
  const { user, year, month , approvalCls, comment} = req.body;
  let sql = '';
  sql += 'UPDATE WORK_INFO SET APPROVAL_CLS = ?, COMMENT = ?';
  sql += ' WHERE USER_ID IN (?)';
  sql += '   AND YEAR = ?';
  sql += '   AND MONTH = ?';
  let param = [approvalCls, comment, user, year, month ];
  console.log(user)
  con.query(sql, param, (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    return res.json({"result": 0})
  })
  
})


/**
 * スキルシート画面関連
 */
// プロジェクト登録
app.post('/saveProjectData', jsonParser, (req, res) => {
  const { user, projectId, mode, startYear, startMonth, endYear, endMonth, businessContent, programLang, framework, database, tool, developProcess} = req.body;
  let sql = '';
  let param = [];
  if(mode === "update") {
    sql += 'UPDATE PROJECT_MANEGE_MST SET START_YEAR = ?';
    sql += '                            , START_MONTH = ?';
    sql += '                            , END_YEAR = ?';
    sql += '                            , END_MONTH = ?';
    sql += '                            , BUSINESS_CONTENT = ?';
    sql += '                            , USE_PROGRAMMING_LANG = ?';
    sql += '                            , USE_FRAMEWORK = ?';
    sql += '                            , USE_DATABASE = ?';
    sql += '                            , USE_TOOL = ?';
    sql += '                            , DEVELOP_PROCESS = ?';
    sql += ' WHERE USER_ID = ?';
    sql += '   AND PROJECT_ID = ?';
    param = [startYear, startMonth, endYear, endMonth, businessContent, programLang, framework, database, tool, developProcess, user, projectId];
  } else {
    sql += 'INSERT PROJECT_MANEGE_MST (USER_ID, PROJECT_ID, START_YEAR, START_MONTH, END_YEAR, END_MONTH, BUSINESS_CONTENT,';
      sql += '                         USE_PROGRAMMING_LANG, USE_FRAMEWORK, USE_DATABASE, USE_TOOL, DEVELOP_PROCESS)';
    sql += '                    VALUE (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    param = [user, projectId, startYear, startMonth, endYear, endMonth, businessContent, programLang, framework, database, tool, developProcess];
  }
  con.query(sql, param, (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    return res.json({"result": 0})
  })
})

// プロジェクトデータ取得
app.post('/getProjectData', jsonParser, (req, res) => {
  const { user,year,month } = req.body;
  let sql = '';
  sql += '     SELECT PROJECT_ID, START_YEAR, START_MONTH, END_YEAR, END_MONTH, BUSINESS_CONTENT, ';
  sql += '            USE_PROGRAMMING_LANG, USE_FRAMEWORK, USE_DATABASE, USE_TOOL, DEVELOP_PROCESS';
  sql += '       FROM PROJECT_MANEGE_MST';
  sql += '      WHERE USER_ID = ?';
  sql += '   ORDER BY CONCAT(START_YEAR, START_MONTH), CONCAT(END_YEAR, END_MONTH)';
  con.query(sql, [user], (err, result) => {
    // エラーが発生した場合はエラーメッセージを返す
    if(err) {
      return res.status(400).json({"error": err.message})
    }
    // エラーが発生しなかった場合はsql文で取得したデータを返す
    if(result.length === 0) {
      res.json({});
    } else {
      let data = []
      for(let i = 0; i < result.length; i++){
        let endYear =  result[i].END_YEAR
        let endMonth =  result[i].END_MONTH
        data.push({
          projectId: result[i].PROJECT_ID,
          startDate: result[i].START_YEAR + "-" + result[i].START_MONTH,
          endDate:  endYear !== "" ? endYear + "-" + endMonth :"",
          endDate2:  endYear !== "" ? endYear + "-" + endMonth : year+ "-" + month,
          businessContent: result[i].BUSINESS_CONTENT,
          programLang : result[i].USE_PROGRAMMING_LANG,
          framework: result[i].USE_FRAMEWORK,
          database: result[i].USE_DATABASE,
          tool: result[i].USE_TOOL,
          developProcess: result[i].DEVELOP_PROCESS,
        })
      }
      res.json(data);
    }
  })
})

// プロジェクトデータ削除
app.post('/deleteProjectData', jsonParser, (req, res) => {
  const { user,projectId } = req.body;
  let sql = '';
  sql += '    DELETE FROM PROJECT_MANEGE_MST';
  sql += '     WHERE USER_ID = ?';
  sql += '       AND PROJECT_ID = ?';
  con.query(sql, [user,projectId], (err, result) => {
      // エラーが発生した場合はエラーメッセージを返す
      if(err) {
        return res.status(400).json({"error": err.message})
      }
      return res.json({"result": 0})
    })
})


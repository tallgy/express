let express = require('express')
let app = express()

app.use('/user/:id1', (req, res, next) => {
  console.log(1);
  next();
  console.log(2);
})

app.get('/user/:id1', function (req, res, next) {
  console.log(3);
  next();
  console.log(4);
}, function (err, req, res, next) {
  console.log('111111111');
  res.end('11')
})

app.get('/user/:id1', function (req, res, next) {
  console.log(5);
  res.end('11')
  console.log(6);
})

// app.use('/user/:id1', (err, req, res, next) => {
//   next('存在错误');
// })


// app.get('/user1/q', function (req, res) {
//   // console.log('6')
//   res.end('qqq')
// })
app.listen(3000,() => console.log('Server is running...'))

/*
如果 err 是 route 那么 layerError 就是 null
如果 err 是 router 那么就会 调用 done 来结束


*/
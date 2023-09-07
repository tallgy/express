let express = require('..')
let app = express()

// app.get('/',(req,res) => res.end('hello world'))

app.use('/user1/:idq', (req, res, next) => {
  console.log(3);
  next();
})

app.get('/user1/:id', (req, res, next) => {
  console.log(4);
  next()
})

// app.use(express.static('./public'))


// app.param(['id', 'page'], function (req, res, next, value) {
//   console.log('param', value)
//   next()
// })


// app.param((name, fn) => {
//   console.log('name fn', name, fn);
//   return function (req, res, next, value) {
//     console.log('param -- 1', value)
//     next()
//   }
// })



app.get('/user/:id1', function (req, res) {
  console.log('gettwo')
  res.end()
})

app.listen(3000,() => console.log('Server is running...'))

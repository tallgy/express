let express = require('..')
let app = express()

app.use('/user/:id1', (req, res, next) => {
  // console.log(3);
  next();
})

app.use('/user/:id1', (req, res, next) => {
  // console.log(4);
  res.end('11');
})
app.get('/user1/:id', (req, res, next) => {
  // console.log(5);
  next()
})

app.get('/user/:id1', function (req, res) {
  // console.log('6')
  res.end()
})
app.get('/user/:id1', function (req, res) {
  // console.log('6')
  res.end()
})

app.listen(3000,() => console.log('Server is running...'))

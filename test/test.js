let express = require('..')
let app = express()

app.use('/user/:id1', (req, res, next) => {
  console.log(3);
  next();
})

app.get('/user1/:id', (req, res, next) => {
  console.log(4);
  next()
})

app.get('/user/:id1', function (req, res) {
  console.log('gettwo')
  res.end()
})
app.get('/user/:id1', function (req, res) {
  console.log('gettwo')
  res.end()
})

app.listen(3000,() => console.log('Server is running...'))

let express = require('..')
let app = express()

app.get('/',(req,res) => res.end('hello world'))

app.use('/a', (req, res) => {
  // console.log(a);
  res.end('a');
})


app.use(express.static('./public'))

app.listen(3000,() => console.log('Server is running...'))

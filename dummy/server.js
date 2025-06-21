const express = require('express');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('pages/login');
});
app.get('/home', (req, res) => {
    res.render('pages/home');
});

app.listen(4000, () => {
  console.log('Frontend running at http://localhost:4000');
});
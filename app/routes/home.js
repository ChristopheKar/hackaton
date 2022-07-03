const path = require('path')
const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
  res.sendFile(
      path.join(__dirname, '../client', 'index.html'))
})

router.use(express.static(path.join(__dirname, '../client')))

router.get('/*', async (req, res, next) => {
  res.sendFile(
      path.join(__dirname, '../client', 'index.html'))
})

// router.use('/index', express.static(path.join('public', 'index.html')));
// router.use('/css', express.static('public/css'));
// router.use('/js', express.static('public/js'));
//
// router.use('/g',  express.static(path.join('build', 'index.html')));
// router.use('/static/css', express.static('build/static/css'));
// router.use('/static/js', express.static('build/static/js'));



module.exports = router;

const path = require('path')
const express = require('express');
const router = express.Router();

router.get('/', async (req, res, next) => {
  res.sendFile(
      path.join(__dirname, '../client', 'index.html'))
})

router.get('/hackaton-video', async (req, res, next) => {
  res.redirect('https://www.youtube.com/watch?v=wpdETyTx5Ak');
})

router.use(express.static(path.join(__dirname, '../client')))

router.get('/*', async (req, res, next) => {
  res.sendFile(
      path.join(__dirname, '../client', 'index.html'))
})


module.exports = router;

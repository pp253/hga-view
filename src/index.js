import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import result10varsmall from './10-varsmall.json'
import result10varlarge from './10-varlarge.json'
import result20varsmall from './20-varsmall.json'
import result20varlarge from './20-varlarge.json'

const db = {
  '10-varsmall': result10varsmall,
  '10-varlarge': result10varlarge,
  '20-varsmall': result20varsmall,
  '20-varlarge': result20varlarge
}

const result = db[FILE]

let maxFit = 0
let minFit = 100000000000
for (let key in result.fitdb) {
  let chro = result.fitdb[key]
  if (chro.fitness === 0) {
    continue
  }
  if (chro.fitness > maxFit) {
    maxFit = chro.fitness
  }
  if (chro.fitness < minFit) {
    minFit = chro.fitness
  }
}
let mm = maxFit - minFit
maxFit = maxFit - mm * 0.4
minFit = minFit - mm * 0.05

console.log(maxFit, minFit)
function findChro(gen, chro) {
  for (let c of gen) {
    if (c.chro.every((v, key) => chro[key] === v)) {
      return c
    }
  }
  console.log('cannot find the chro')
}

let chroDB = {}

let lastGen = null
for (let model of result['tracking']['models']) {
  switch (model.type) {
    case 'init_pop':
    case 'final_pop':
      model.chro.sort((a, b) => a.fitness - b.fitness)
      for (let chro of model.chro) {
        switch (chro.method) {
          case 'pri_hung':
          case 'mutate_pri_hung':
            chro.trace = []
            break
          case 'copy':
            chro.trace = [findChro(lastGen, chro.method_args)]
            break
          default:
            console.log('unknown type')
        }
        let key = `(${chro.chro.join(', ')})`
        if (!chroDB[key]) {
          chroDB[key] = []
        }
        chroDB[key].push(chro)
      }
      lastGen = model.chro
      break
    case 'ga':
      for (let gen of model.gen) {
        gen.chro.sort((a, b) => a.fitness - b.fitness)
        for (let chro of gen.chro) {
          switch (chro.method) {
            case 'copy':
            case 'mutate':
            case 'cri_mutate':
            case 'hung_boosting':
              chro.trace = [findChro(lastGen, chro.method_args)]
              break
            case 'job_order_crossover':
              chro.trace = [
                findChro(lastGen, chro.method_args[0]),
                findChro(lastGen, chro.method_args[1])
              ]
              break
            default:
              console.log('unknown type')
          }
          let key = `(${chro.chro.join(', ')})`
          if (!chroDB[key]) {
            chroDB[key] = []
          }
          chroDB[key].push(chro)
        }
        lastGen = gen.chro
      }
      break
    default:
      console.log('unknown type')
  }
}

console.log(result)
/**
 * From the example of
 * https://davidfig.github.io/pixi-viewport/jsdoc/
 */
const app = new PIXI.Application({
  backgroundColor: 0x413c5a,
  width: window.innerWidth,
  height: window.innerHeight
})
document.body.appendChild(app.view)

let options = {
  seq: {
    padding: { x: 30, y: 30 }
  },
  model: {
    padding: { x: 20, y: 20 },
    interval: 80
  },
  gen: {
    padding: { x: 5, y: 5 },
    interval: 10
  },
  chro: {
    interval: 3,
    width: 30,
    height: 10
  },
  color: {
    methods: {
      copy: 0xe37e2b,
      mutate: 0x1a86c7,
      cri_mutate: 0xe43733,
      hung_boosting: 0x4ac1c0,
      job_order_crossover: 0x10ff00,
      pri_hung: 0x0400ff,
      mutate_pri_hung: 0x00b9ff
    },
    selected: 0x0,
    duplicated: 0x0
  }
}

let textInfo
function updateInfo(chro, infoCon) {
  // text
  if (!textInfo) {
    textInfo = infoCon.addChild(
      new PIXI.Text('', {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xffffff,
        align: 'left'
      })
    )
    textInfo.position.set(10, 10)
    textInfo.anchor.set(0, 0)
  }
  textInfo.text = `fitness: ${chro.fitness.toFixed(3)}, method: ${
    chro.method
  }, iter_time: ${chro.iter_time}\nchro: ${chro.chro}`
}

function highlight(chro, hlCon, seqCon) {
  let rects = hlCon.addChild(new PIXI.Graphics())

  for (let trace of chroDB[`(${chro.chro.join(', ')})`]) {
    let sprite = trace.sprite
    let pos = sprite.toLocal({ x: 0, y: 0 }, seqCon)
    pos = {
      x: -pos.x,
      y: -pos.y
    }

    rects.beginFill(0x30d7f3, 1)
    rects.drawRect(pos.x, pos.y, options.chro.width, options.chro.height)
    rects.endFill()
  }
}

function preview(chro, previewCon, seqCon) {
  selectChro(chro, previewCon, seqCon, undefined, undefined, false)
}

let selectChroRelationDB = []
const MAX_REC = 8

function constructSelectChro(
  chro,
  linksCon,
  seqCon,
  rec = 0,
  recursive = true
) {
  let slot = Math.floor(rec / MAX_REC)
  if (selectChroRelationDB.length <= slot) {
    selectChroRelationDB.push([])
  }
  let dbSlot = selectChroRelationDB[slot]
  rec = rec + 1

  if (!dbSlot.every(v => v[0] !== chro)) {
    return
  }

  for (let trace of chro.trace) {
    dbSlot.push([chro, trace, chro.method])
    if (recursive) {
      constructSelectChro(trace, linksCon, seqCon, rec, recursive)
    }
  }
}

function selectChro(chro, linksCon, seqCon, recursive = true) {
  selectChroRelationDB = []
  let rec = 0
  constructSelectChro(chro, linksCon, seqCon, rec, recursive)

  // draw
  let drawedDot = []
  for (let slot of selectChroRelationDB) {
    let arrow = linksCon.addChild(new PIXI.Graphics())
    let dot = linksCon.addChild(new PIXI.Graphics())

    for (let combo of slot) {
      let [kid, parent, method] = combo

      let chro = kid
      let sprite = chro.sprite
      let pos = sprite.toLocal({ x: 0, y: 0 }, seqCon)
      pos = {
        x: -pos.x + options.chro.width / 2,
        y: -pos.y + options.chro.height / 2
      }

      // draw the center dot
      if (!drawedDot.includes(kid)) {
        dot.beginFill(0xffffff, 1)
        dot.drawCircle(pos.x, pos.y, 3)
        dot.endFill()

        drawedDot.push(kid)
      }

      // draw the relationship
      let posT = parent.sprite.toLocal({ x: 0, y: 0 }, seqCon)
      posT = {
        x: -posT.x + options.chro.width / 2,
        y: -posT.y + options.chro.height / 2
      }

      arrow
        .lineStyle(1, options.color.methods[method])
        .moveTo(pos.x, pos.y)
        .lineTo(posT.x, posT.y)
    }
  }
}

// https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
function hslToRgb(h, s, l) {
  var r, g, b

  if (s == 0) {
    r = g = b = l // achromatic
  } else {
    var hue2rgb = function hue2rgb(p, q, t) {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    var q = l < 0.5 ? l * (1 + s) : l + s - l * s
    var p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return (
    Math.round(r * 255) * 65536 +
    Math.round(g * 255) * 256 +
    Math.round(b * 255)
  )
}

function calColor(fit) {
  let percentage = (maxFit - fit) / (maxFit - minFit)
  if (percentage < 0) {
    percentage = 0
  } else if (percentage > 1) {
    percentage = 1
  }
  return hslToRgb(305 / 365, 1, percentage * percentage)
}

function drawGen(chro, genGroup, linksCon, seqCon, previewCon, infoCon, hlCon) {
  const genCon = genGroup.addChild(new PIXI.Container())
  const chroGroup = genCon.addChild(new PIXI.Container())
  chroGroup.position.set(options.gen.padding.x, options.gen.padding.y)

  for (let i = 0; i < chro.length; i++) {
    const chroSpr = chroGroup.addChild(new PIXI.Graphics())
    chroSpr.tint = calColor(chro[i].fitness) // 0xda38a1
    chroSpr.beginFill(calColor(chro[i].fitness), 1)
    chroSpr.drawRect(0, 0, options.chro.width, options.chro.height)
    chroSpr.endFill()

    /*
    let circle = chroSpr.addChild(new PIXI.Graphics())
    circle.beginFill(0xffffff, 1)
    circle.drawCircle(0, 0, 3)
    circle.endFill()
    */

    // chroSpr.anchor.set(0, 0)
    chroSpr.position.set(0, i * options.chro.height + i * options.chro.interval)
    chroSpr.interactive = true
    chroSpr.buttonMode = true

    chroSpr.on('click', () => {
      console.log('click', chro[i])
      linksCon.removeChildren()
      selectChro(chro[i], linksCon, seqCon)
      hlCon.removeChildren()
      highlight(chro[i], hlCon, seqCon)
    })
    chroSpr.on('mouseover', () => {
      preview(chro[i], previewCon, seqCon)
      updateInfo(chro[i], infoCon)
    })
    chroSpr.on('mouseout', () => {
      previewCon.removeChildren()
    })

    chro[i].sprite = chroSpr
  }
  return genCon
}

function drawSeq(seq, viewport, linksCon, previewCon, infoCon, hlCon) {
  const seqCon = viewport.addChild(new PIXI.Container())
  const gr = seqCon.addChild(new PIXI.Graphics())
  gr.beginFill(0x2d2855, 0)
  gr.drawRect(
    0 - options.seq.padding.x,
    0 - options.seq.padding.y,
    2000 + options.seq.padding.x,
    1000 + options.seq.padding.y
  )
  gr.endFill()

  let sy = 0
  for (let model of seq['models']) {
    const modelCon = seqCon.addChild(new PIXI.Container())
    modelCon.position.set(sy, 0)

    // background
    const bg = modelCon.addChild(new PIXI.Sprite(PIXI.Texture.WHITE))
    bg.tint = 0x26263e
    bg.height =
      model.config.p_size * options.chro.height +
      (model.config.p_size - 1) * options.chro.interval +
      options.gen.padding.y * 2 +
      options.model.padding.y * 2
    bg.position.set(0, 0)

    // text
    let textInfo =
      `${model.type.toUpperCase()}\np_size: ${model.config.p_size}` +
      (model.config.max_gen ? `, max_gen: ${model.config.max_gen}` : '')
    const text = modelCon.addChild(
      new PIXI.Text(textInfo, {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0xffffff,
        align: 'left'
      })
    )
    text.position.set(0, -10)
    text.anchor.set(0, 1)

    const genGroup = modelCon.addChild(new PIXI.Container())
    genGroup.position.set(options.model.padding.x, options.model.padding.y)
    let cx = 0

    if (model['chro'].length > 0) {
      let genCon = drawGen(
        model['chro'],
        genGroup,
        linksCon,
        seqCon,
        previewCon,
        infoCon,
        hlCon
      )
      genCon.position.set(cx, 0)
      cx += genCon.width + options.gen.padding.x * 2
    } else {
      for (let gen of model['gen']) {
        let genCon = drawGen(
          gen['chro'],
          genGroup,
          linksCon,
          seqCon,
          previewCon,
          infoCon,
          hlCon
        )
        genCon.position.set(cx, 0)
        cx += genCon.width + options.gen.padding.x * 2 + options.gen.interval
      }
      cx -= options.gen.interval
    }

    bg.width = cx + options.model.padding.x * 2

    sy += genGroup.width + options.model.padding.x * 2 + options.model.interval
  }
  return seqCon
}

function setup() {
  console.log('setup')

  // create viewport
  const viewport = new Viewport({
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    worldWidth: 2000,
    worldHeight: 2000,

    interaction: app.renderer.plugins.interaction // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
  })

  // add the viewport to the stage
  app.stage.addChild(viewport)

  // activate plugins
  viewport
    .drag()
    .pinch()
    .wheel()
    .decelerate()

  let linksCon = new PIXI.Container()
  let previewCon = new PIXI.Container()
  let hlCon = new PIXI.Container()
  let infoCon = new PIXI.Container()
  const layer = {
    links: linksCon,
    preview: previewCon,
    hl: hlCon,
    info: infoCon
  }
  hlCon.position.set(0, 0)
  linksCon.position.set(0, 0)
  previewCon.position.set(0, 0)

  infoCon.position.set(0, window.innerHeight - 80)
  let bg = infoCon.addChild(new PIXI.Graphics())
  bg.beginFill(0x282f39)
  bg.drawRect(0, 0, window.innerWidth, 80)
  bg.endFill()

  let seqCon = drawSeq(
    result['tracking'],
    viewport,
    linksCon,
    previewCon,
    infoCon,
    hlCon
  )

  seqCon.addChild(hlCon)
  seqCon.addChild(linksCon)
  seqCon.addChild(previewCon)

  app.stage.addChild(infoCon)
}

function resize() {}

app.loader.load(setup)
/*
const sprite = viewport.addChild(new PIXI.Sprite(PIXI.Texture.WHITE))
sprite.tint = 0x26e8fc
sprite.width = sprite.height = 100
sprite.position.set(100, 100)
*/

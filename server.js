import express from 'express'
import sql from 'mssql'
import {DB_CONFIG} from './config.js'

const app = express()
const PORT = 8000

const FOLDER = 'Папка'
const DISH = 'Блюда'

app.use(express.json())
app.use(express.urlencoded({extended: false}))

app.listen(PORT, () => console.log(`It's alive on http://localhost:${PORT}`))

app.get('/', async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*')
    const menuGroups = await getMenuGroups(0)
    res.send(menuGroups)
})

app.get('/dishes', async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*')
    const partOfMenu = req?.query?.partOfMenu
    const menuGroups = await getMenuGroups(partOfMenu)
    const groupName = await getGroupName(partOfMenu)
    const menuDishes = await getMenuDishes(partOfMenu)
    res.send({menuGroups, groupName, menuDishes})
})

sql.connect(DB_CONFIG, (err, pool) => {
    if (err) return console.error(err)

    console.log('DB connection established - starting web server')
    const server = app.listen(1433)
    server.on('close', sql.close.bind(sql))
})

async function getMenuBoard(partOfMenu) {
    const menuBoard = await sql.query(
        `EXEC [dbo].[procCreateMenuButtonsForMenuboard] ${partOfMenu}`
    )
    return menuBoard.recordset
}

async function getMenuGroups(partOfMenu) {
    const menuBoard = await getMenuBoard(partOfMenu)
    return menuBoard.filter(group => group.Type === FOLDER)
}

async function getMenuDishes(partOfMenu) {
    const menuBoard = await getMenuBoard(partOfMenu)
    const menuDishes = menuBoard.filter(group => group.Type === DISH)
    const dishIdList = menuDishes.map(dish => dish.ID)
    return await getDishesInfo(dishIdList)
}

async function getGroupName(partOfMenu) {
    let groupInfo = await sql.query(`SELECT *
                                     FROM tblPartOfMenu
                                     WHERE ID = ${partOfMenu}`)
    return groupInfo?.recordset?.at(0)?.Name
}

async function getDishesInfo(dishIdList) {
    if (dishIdList.length === 0) return []

    let idList = dishIdList.join(', ')

    let dishInfo = await sql.query(`
        SELECT p.ID,
               p.Name,
               p.PriceForMenu,
               p.description,
               p.pathToImage,
               STUFF((SELECT ';' + tblProduct.Name
                      FROM tblProduct
                      WHERE tblProduct.ID = ANY (SELECT tblDishDetails.ProductID
                                                 FROM tblProduct
                                                          LEFT JOIN tblDishDetails ON tblDishDetails.DishID = tblProduct.ID
                                                 WHERE tblProduct.ID = p.ID)
                   FOR XML PATH ('')), 1, 1, '')
                                                 AS IngredientNameList,
               STUFF((SELECT ';' + tblProductPhoto.pathToImage
                      FROM tblProduct
                               LEFT JOIN tblProductPhoto ON tblProductPhoto.productId = tblProduct.ID
                      WHERE tblProductPhoto.productId = p.ID
                   FOR XML PATH ('')), 1, 1, '') AS ImageList
        FROM tblProduct p
        WHERE p.ID IN (${idList});
    `)

    return getDishWithPhotoPacked(dishInfo.recordset)
}

function getDishWithPhotoPacked(dishInfo) {
    let dishes = []

    for (let dish of dishInfo) {
        let images = dish.pathToImage ? [dish.pathToImage] : []
        let newImages = dish?.ImageList?.split(';')
        let ingredients = dish?.IngredientNameList ? dish?.IngredientNameList?.split(';') : []

        if (newImages) {
            images.push(...newImages)
        }

        dishes.push({...dish, photo: images, ingredients})
    }

    return dishes
}

function isObjectInArray(fieldName, value, array) {
    const index = array.findIndex(el => el[fieldName] === value)
    return index !== -1
}

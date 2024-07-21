import puppeteer from "puppeteer";
import express from "express"
import rateLimit from "express-rate-limit"
import cors from "cors"

const app = express()

//Limitar solicitudes 
const limiter = rateLimit({
    minuto: 60*1000,
    max: 20,
    message: 'Excediste el limite de solicitudes por minuto'
});

//Tokens que son validos para poder usar nuestra API
const tokensValidos = new Set([
    'token1',
    'token2',
]);

//Funcionalidad para autenticar que los tokens enviados sean validos
// const authenticateToken = (req, res, next ) => {
//     //Se obtiene la cabecera del request authorization
//     const authHeader = req.headers['authorization'];
//     //Se obtiene el token enviado
//     const token = authHeader && authHeader.split(' ')[1];
//     //Validamos que el token exista en nuestra BD de TokensValidos
//     if(!token || !tokensValidos.has(token)){
//         return res.sendStatus(401); // No autorizado
//     }
//     next();
// };

app.use(cors())
app.use(limiter);
// app.use(authenticateToken); 
app.use(express.json());



//WEB SCRAPPER OFFSHORE LEAKS
async function getDataFromWebOffShoreLeaks(res){
    //Se inicializa un browser
    const browserP = await puppeteer.launch({
        headless:true
    });
    let page;
    //Abrimos una nueva pagina y que se dirija al link de offshoreleaks
    page = await browserP.newPage();
    await page.goto('https://offshoreleaks.icij.org/');
    
    //Le decimos que, a cada elemento a dentro de un <li> contenido dentro de un <ul> con clase .ul.overflow-auto, le extraiga su href para dirigirse a su respectiva pagina con los detalles
    //Esto sirve para recorrer cada link de cada investigacion con todos los detalles
    const links = await page.$$eval('ul.overflow-auto > li > a ', links=> links.map(link => link.href))
    
    let papers = []

    //Recorremos cada pagina de las investigaciones 
    for(let link of links){
        await page.goto(link);
        //Esperamos a que cargue el body y la tabla
        await page.waitForSelector('body');
        await page.waitForSelector('table');
        const data = await page.evaluate(() => {
            //Seleccionamos el elemento DATA FROM que contiene la clase .source-header__container__label
            const src = document.querySelector('.source-header__container__label');

            //Recorremos cada fila de la tabla donde se encuentra la información
            const rows = Array.from(document.querySelectorAll('table tr'));
            const investigation = rows.map(row => {
                //Por cada fila seleccionamos los td para almacenarlos
                const columns = row.querySelectorAll('td');
                return{
                    //Retornamos los elementos de la tabla y el DATA FROM
                    entity: columns[0]?.innerText.trim(),
                    jurisdiction: columns[1]?.innerText.trim(),
                    linkedto: columns[2]?.innerText.trim(),
                    dataFrom: src.innerText
                }
            })

            return {
                hits: investigation.length,
                investigation
            };
            
        })
        //Almacenamos en nuestro arreglo 
        papers.push(data)
        
        
    }
    //Una vez terminada la tarea, cerramos el buscador.
    await browserP.close();

    //Nuestro arreglo que contiene toda la información, lo convertimos a format json
    res.json(papers);
}

//WEB SCRAPPER THE WORLD BANK
async function getDataFromTheWorldBank(res){
        
        //Se inicializa un browser
        const browserP = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        let page;
        //Abrimos una nueva pagina y que se dirija al link de The World Bank
        page = await browserP.newPage();
        await page.goto('https://projects.worldbank.org/en/projects-operations/procurement/debarred-firms');
        //Esperamos a que cargue el body
        await page.waitForSelector('body');
        //Esperamos a que cargue el div que contiene la tabla con la informacion
        await page.waitForSelector('div.k-grid-content.k-auto-scrollable');
        const data = await page.evaluate(() => {
            //Seleccionamos los <tr> de la tabla elegida
            const rows = Array.from(document.querySelectorAll('div.k-grid-content.k-auto-scrollable table tbody tr'));
            //Almacenamos todos los datos obtenidos de la pagina web
            const debarredFirms = rows.map(row => {
                    const columns = row.querySelectorAll('td');
                    return{
                        firmName: columns[0]?.innerText.split("*")[0],
                        address: columns[2]?.innerText,
                        country: columns[3]?.innerText,
                        fromDate: columns[4]?.innerText,
                        toDate: columns[5]?.innerText,
                        grounds: columns[6]?.innerText,
                    }

                    
            });
            //Retornamos los datos scrapeados y la cantidad de datos encontrados
            return {
                hits: debarredFirms.length,
                debarredFirms

            };
        });
        //Cerramos el navegador
        await browserP.close()
        //Convertimos el resultado a formato json
        res.json(data);
}

//WEB SCRAPPER OFAC
async function getDataFromOFAC(res){
    //Se inicializa un browser
    const browserP = await puppeteer.launch({
        headless: true
    });
    let page;
    //Abrimos una nueva pagina y que se dirija al link de The World Bank
    page = await browserP.newPage();
    await page.goto('https://sanctionssearch.ofac.treas.gov/');
    //Esperamos a que cargue el body
    await page.waitForSelector('body');

    await page.waitForSelector('select#ctl00_MainContent_ddlType');
    await page.select('select#ctl00_MainContent_ddlType', 'Entity');

    await page.type('input#ctl00_MainContent_txtLastName', 'A');

    await page.click('input#ctl00_MainContent_btnSearch');

    await page.waitForSelector('table#gvSearchResults')

    const data = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table#gvSearchResults tbody tr'));

        const sanctions = rows.map(row => {
            const columns = row.querySelectorAll('td');
            return {
                name: columns[0]?.innerText,
                address: columns[1]?.innerText,
                type: columns[2]?.innerText,
                programs: columns[3]?.innerText,
                list: columns[4]?.innerText,
                score: columns[5]?.innerText
            }
        })

        return {
            hits: sanctions.length,
            sanctions
        }
    });

    await browserP.close()

    res.json(data);
}



app.get('/api/offshoreleaks',(req,res) => {
    getDataFromWebOffShoreLeaks(res);
});

app.get('/api/worldbank', (req,res) =>{
    getDataFromTheWorldBank(res);
});

app.get('/api/ofac', (req, res) => {
    getDataFromOFAC(res);
})

app.listen(3001,()=>{
    console.log('Servidor iniciado en puerto 3001');
});


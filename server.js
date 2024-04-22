import express from 'express';
const app = express();
import bodyParser from 'body-parser';
import fs from 'fs';
import cors from 'cors';

const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));

app.use(bodyParser.json({ limit: '10mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.post('/saves', (req, res) => 
        {
                const sceneState = req.body;
                const sceneStateString = JSON.stringify(sceneState);

                fs.writeFile('./scene.json', sceneStateString, (err) => 
                        {
                                if (err) 
                                {
                                        console.error(err);
                                        res.status(500).json(
                                                { message: 'Failed to save scene' }
                                        );
                                } 
                                else 
                                {
                                        res.json({ message: 'Scene saved successfully' });
                                }
                });
        });

app.listen(3000, () => 
        {
                console.log('Server listening on port 3000');
        });

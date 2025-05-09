import { v2 as cloudinary } from 'cloudinary';


// Configuration
cloudinary.config({
    cloud_name: "dqm9lt31g",
    api_key: "473345132488826",
    api_secret: "UX5H4-zQwG-RU5eFVHdST5bB68s"
});

export const cloudinaryInstance = cloudinary
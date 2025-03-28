const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

require('dotenv').config();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// I have created this function to fetch the access token dynamically so that I can avoid the token expiry issue, also this function will be called every time when we make a request to the API
async function fetchAccessToken() {
    try {
        const response = await axios.post(`${process.env.AUTH_URL}`, {
            companyName: process.env.COMPANY_NAME,
            clientID: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
            ownerName: process.env.OWNER_NAME,
            ownerEmail: process.env.OWNER_EMAIL,
            rollNo: process.env.ROLL_NO
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching access token:', error.message);
    }
}

// This route will fetch all the users from the API and then log the users in the console
//Now I have completed the sorting of users on the basis of postCount and then returning the top 5 users
app.get('/users', async (req, res) => {
    try {
        const accessToken = await fetchAccessToken(); 
        const response = await axios.get('http://20.244.56.144/test/users', {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });
        const users = response.data.users;

        const userArray = Object.entries(users).map(([id, name]) => ({ id, name }));

        const userPostCounts = await Promise.all(userArray.map(async (user) => {
            const postsResponse = await axios.get(`http://20.244.56.144/test/users/${user.id}/posts`, { 
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });
            return { user, postCount: postsResponse.data.posts.length }; // Use `posts` array length
        }));

            // This will Sort(on the basis of comparison sorting) the  users I fetched by post count in descending order and return the top 5
            const topUsers = userPostCounts
                .sort((a, b) => b.postCount - a.postCount)
                .slice(0, 5)
                .map(({ user, postCount }) => ({ ...user, postCount }));

        res.json(topUsers);
    } catch (error) {
        console.error('Error in /users route:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch top users' });
    }
});

app.get('/posts', async (req, res) => {
    try {
        const { type } = req.query;
        if (!type || !['popular', 'latest'].includes(type)) {
            return res.status(400).json({ error: 'Invalid or missing type query parameter' });
        }
        //doing the same as above to fetch the access token
        const accessToken = await fetchAccessToken();

        // this is used for fetching all posts 
        const usersResponse = await axios.get('http://20.244.56.144/test/users', {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });
        const users = Object.keys(usersResponse.data.users);

        const allPosts = [];
        for (const userId of users) {
            const postsResponse = await axios.get(`http://20.244.56.144/test/users/${userId}/posts`, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            });
            allPosts.push(...postsResponse.data.posts);
        }

        if (type === 'popular') {
            //First fetch all the comments for each post and then find the post with the maximum number of comments
            const postsWithComments = await Promise.all(allPosts.map(async (post) => {
                const commentsResponse = await axios.get(`http://20.244.56.144/test/posts/${post.id}/comments`, {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`
                    }
                });
                return { ...post, commentCount: commentsResponse.data.comments.length };
            }));

            const maxComments = Math.max(...postsWithComments.map(post => post.commentCount));
            const popularPosts = postsWithComments.filter(post => post.commentCount === maxComments);
            return res.json(popularPosts);
        } else if (type === 'latest') {
            //here I have done the same sorting as in /users route to get the latest 5 posts
            const latestPosts = allPosts
                .filter(post => post.createdAt) 
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);
            return res.json(latestPosts);
        }
    } catch (error) {
        console.error('Error in /posts route:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
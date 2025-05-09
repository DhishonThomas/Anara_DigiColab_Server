export const volunteerToken = (volunteer, statusCode, message, res) => {
    const token = volunteer.generateToken();
    res
      .status(statusCode)
      .cookie("token", token, {
        expires: new Date(
          Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
      })
      .json({
        success: true,
        volunteer,
        message,
        token,
      });
  };
  